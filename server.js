// Express API Server with request logging and echo endpoint

const express = require('express');
const morgan = require('morgan'); // HTTP request logger middleware
const helmet = require('helmet'); // Security middleware
const cors = require('cors'); // CORS middleware
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  // Development-only middleware configuration
  app.use(helmet({
    // Disable ContentSecurityPolicy for local development
    contentSecurityPolicy: false,
    // Disable SSL enforcement
    hsts: false,
    // Disable crossOriginEmbedderPolicy for local development
    crossOriginEmbedderPolicy: false,
    // Disable crossOriginResourcePolicy for local development
    crossOriginResourcePolicy: false
  }));

  // Configure CORS to allow all origins in development
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
} else {
  // Production configuration
  app.use(helmet());
  app.use(cors()); // Use default restrictive CORS settings
}

const db = new sqlite3.Database('events.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        // Create events table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                type TEXT NOT NULL,
                route_to TEXT,
                body TEXT NOT NULL,
                tags TEXT,
                summary TEXT,
                title TEXT
            )
        `);
    }
});


// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors());

// Middleware for parsing JSON bodies with size limit
app.use(express.json({ limit: '10mb' }));

// Setup request logging middleware with custom format
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

// Rate limiting middleware
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Echo endpoint - returns the POST request body as-is
app.post('/echo', async (req, res) => {
    try {
        // Log the received JSON to stdout
        console.log('Received POST data:', req.body);
        
        // Send back the same JSON that was received
        res.status(200).json(req.body);
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// CREATE - Post new event
app.post('/event', async (req, res) => {
    try {
        const { date, type, route_to, body, tags, summary, title } = req.body;
        
        // Validate required fields
        if (!date || !type || !body) {
            return res.status(400).json({ error: 'date, type, and body are required fields' });
        }

        const sql = `
            INSERT INTO events (date, type, route_to, body, tags, summary, title)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [
            date,
            type,
            route_to || null,
            body,
            tags ? JSON.stringify(tags) : null,
            summary || null,
            title || null
        ], function(err) {
            if (err) {
                console.error('Error inserting event:', err);
                return res.status(500).json({ error: 'Failed to create event' });
            }
            res.status(201).json({
                id: this.lastID,
                message: 'Event created successfully'
            });
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// READ - Get all events
app.get('/event', async (req, res) => {
    try {
        // Use parameterized query to prevent SQL injection
        const sql = 'SELECT * FROM events ORDER BY date DESC';
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Error fetching events:', err);
                return res.status(500).json({ error: 'Failed to fetch events' });
            }
            // Sanitize response data
            const sanitizedRows = rows.map(row => ({
                ...row,
                body: row.body.replace(/<[^>]*>/g, ''), // Remove HTML tags
                tags: row.tags ? JSON.parse(row.tags) : null,
                summary: row.summary ? row.summary.replace(/<[^>]*>/g, '') : null,
                title: row.title ? row.title.replace(/<[^>]*>/g, '') : null
            }));
            res.json(sanitizedRows);
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// READ - Get single event by ID 
app.get('/event/:id', async (req, res) => {
    try {
        // Validate ID is numeric
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        // Use parameterized query to prevent SQL injection
        const sql = 'SELECT * FROM events WHERE id = ?';
        db.get(sql, [id], (err, row) => {
            if (err) {
                console.error('Error fetching event:', err);
                return res.status(500).json({ error: 'Failed to fetch event' });
            }
            if (!row) {
                return res.status(404).json({ error: 'Event not found' });
            }
            // Sanitize response data
            const sanitizedRow = {
                ...row,
                body: row.body.replace(/<[^>]*>/g, ''), // Remove HTML tags
                tags: row.tags ? JSON.parse(row.tags) : null,
                summary: row.summary ? row.summary.replace(/<[^>]*>/g, '') : null,
                title: row.title ? row.title.replace(/<[^>]*>/g, '') : null
            };
            res.json(sanitizedRow);
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// UPDATE - Update an event
app.put('/event/:id', async (req, res) => {
    try {
        // Validate ID is numeric
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        const { date, type, route_to, body, tags, summary, title } = req.body;
        
        // Validate required fields
        if (!date || !type || !body) {
            return res.status(400).json({ error: 'date, type, and body are required fields' });
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(date)) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        // Sanitize input data
        const sanitizedBody = body.replace(/<[^>]*>/g, '');
        const sanitizedSummary = summary ? summary.replace(/<[^>]*>/g, '') : null;
        const sanitizedTitle = title ? title.replace(/<[^>]*>/g, '') : null;
        const sanitizedType = type.replace(/[^a-zA-Z0-9_-]/g, '');
        const sanitizedRouteTo = route_to ? route_to.replace(/[^a-zA-Z0-9_-]/g, '') : null;

        const sql = `
            UPDATE events 
            SET date = ?, type = ?, route_to = ?, body = ?, tags = ?, summary = ?, title = ?
            WHERE id = ?
        `;

        db.run(sql, [
            date,
            sanitizedType,
            sanitizedRouteTo,
            sanitizedBody,
            tags ? JSON.stringify(tags) : null,
            sanitizedSummary,
            sanitizedTitle,
            id
        ], function(err) {
            if (err) {
                console.error('Error updating event:', err);
                return res.status(500).json({ error: 'Failed to update event' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Event not found' });
            }
            res.json({ message: 'Event updated successfully' });
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE - Delete an event
app.delete('/event/:id', async (req, res) => {
    try {
        // Validate ID is numeric
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }

        // Use parameterized query to prevent SQL injection
        const sql = 'DELETE FROM events WHERE id = ?';
        db.run(sql, [id], function(err) {
            if (err) {
                console.error('Error deleting event:', err);
                return res.status(500).json({ error: 'Failed to delete event' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Event not found' });
            }
            res.json({ message: 'Event deleted successfully' });
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// Start the server
const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Graceful shutdown with database cleanup
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server and database');
    server.close(() => {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed');
            }
            console.log('HTTP server closed');
            process.exit(0);
        });
    });
});
