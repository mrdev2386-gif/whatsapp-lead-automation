const { exec } = require('child_process');
exec('node demo/index.js --session=916299261088', (error, stdout, stderr) => {
    console.log('--- STDOUT ---');
    console.log(stdout);
    console.log('--- STDERR ---');
    console.log(stderr);
    if (error) {
        console.log('--- ERROR ---');
        console.log(error);
    }
});
