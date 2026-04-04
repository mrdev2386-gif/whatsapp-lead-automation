try {
    console.log("Starting debug require...");
    require('./demo/index.js');
    console.log("Require successful");
} catch (e) {
    console.error("FATAL ERROR CAUGHT IN WRAPPER:");
    console.error(e);
}
