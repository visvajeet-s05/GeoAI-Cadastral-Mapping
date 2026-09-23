const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.join(__dirname, '../node_modules/georaster/dist/georaster.browser.bundle.min.js'),
  path.join(__dirname, '../node_modules/georaster/dist/georaster.browser.bundle.js'),
  path.join(__dirname, '../node_modules/cross-fetch/dist/browser-ponyfill.js'),
];

for (const filePath of filesToPatch) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    if (content.includes('this.fetch=!1')) {
      content = content.replace(
        'this.fetch=!1',
        'Object.defineProperty(this,"fetch",{value:!1,writable:!0,configurable:!0})'
      );
      modified = true;
    }

    if (content.includes('this.fetch = false')) {
      content = content.replace(
        /this\.fetch\s*=\s*false/g,
        'Object.defineProperty(this, "fetch", { value: false, writable: true, configurable: true })'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[patch-cross-fetch] Successfully patched ${path.basename(filePath)}`);
    }
  }
}
