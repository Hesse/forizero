#!/usr/bin/env node

const fs = require('fs').promises; // Use fs.promises for async operations
const { time } = require('console');
const path = require('path');
const { serialize } = require('v8');
const marked = require('marked');

// Directory containing JSON files
const directoryPath = path.join(__dirname, '../_posts/');

async function readJsonFiles() {
    const lastGenerated = new Date().toISOString();
    let jsonData = {posts: [], count: 0, lastGenerated:lastGenerated};
    let streams = new Set();
    try {
        // Read the directory
        const files = await fs.readdir(directoryPath);

        // Filter JSON files and process them
        for (const file of files) {
            if (path.extname(file) === '.json') {
                console.log(file)
                try {
                    let post_id = path.basename(file, '.json').substring(0, path.basename(file, '.json').indexOf("_"))
                    console.log(post_id);
                    const post = await fs.readFile(path.join(directoryPath, file), 'utf8');
                    let jsonPost = JSON.parse(post)
                    let postBody = marked.marked(jsonPost.body)
                    console.log(postBody);
                    jsonPost.body = postBody;
                    if (jsonPost.hasOwnProperty('tags') && jsonPost.tags.length > 0) {
                        jsonPost.tags.forEach(element => {
                            streams.add(element);
                        });
                    }   
                    jsonPost.post_id = post_id;
                    jsonData.posts.push(jsonPost);
                    jsonData.count +=1;

                    
                } catch (err) {
                    console.error(`Error reading or parsing file ${file}:`, err);
                }
            }
        }

        // order desc
        jsonData.posts.sort((a, b) => b.post_id - a.post_id)
        jsonData.streams = Array.from(streams);

        console.log(JSON.stringify(jsonData)); // Log after all files are processed
        const postDataFilePath = path.join(__dirname, '../dist/postData.json');
        await fs.writeFile(postDataFilePath, JSON.stringify(jsonData, null, 0));
        console.log(`postData.json file has been generated with ${jsonData.count} posts.`);
    } catch (err) {
        console.error('Unable to scan directory:', err);
    }
}

function processTags() {

}

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite3');

async function readDbFile() {
    let dbData = [];
    const dbPath = path.join(__dirname, '../events.db');

    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
                return;
            }
        });

        db.all("SELECT * FROM events", [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            rows.forEach((row) => {
                dbData.push(row);
            });

            db.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(dbData);
            });
        });
    });
}
readDbFile().then((dbData) => {
    console.log('dbData:', dbData);
}).catch((err) => {
    console.error('Error reading dbData:', err);
});

readJsonFiles();