#!/usr/bin/env node

const inquirer = require("inquirer");
const editor = require('@inquirer/editor');
const fs = require('fs').promises; // Use fs.promises for async operations
const path = require('path');
//  
  inquirer.default
    .prompt([
      {
          type: "editor", name: "body", message: "write a post",
      },
      {
        type: "input", name: "title", message: "title",
      },
    ])
    .then(async (answers) => {
        answers.date = new Date().toISOString().split('T')[0]
        let postCount = await fs.readdir(path.join(__dirname, '../_posts/')).then(files => files.filter(file => path.extname(file) === '.json').length);
        const filePath = path.join(__dirname, '../_posts/', `${postCount}_${answers.date.split('T')[0]}-${answers.title.replace(/ /g, '-').toLowerCase()}.json`);
        await fs.writeFile(filePath, JSON.stringify(answers, null, 2), 'utf8');
    })
    // .then(async() => { console.log("do something")
    //     const { exec } = require('child_process');
    //     exec('node render.js', (error, stdout, stderr) => {
    //         if (error) {
    //             console.error(`Error executing render.js: ${error.message}`);
    //             return;
    //         }
    //         if (stderr) {
    //             console.error(`stderr: ${stderr}`);
    //             return;
    //         }
    //         console.log(`stdout: ${stdout}`);
    //     });
    // })
    .catch((error) => {
      if (error.isTtyError) {
        // Prompt couldn't be rendered in the current environment
      } else {
        // Something else went wrong
      }
    });


