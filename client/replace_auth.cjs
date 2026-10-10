const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(srcDir);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace the Authorization headers block that looks like:
    // headers: {
    //   'Authorization': Bearer ,
    //   ...
    // }
    // Or similar variations
    
    // We can just use a simple regex for the auth header
    content = content.replace(/'Authorization': Bearer \$\{token\},\s*/g, '');
    content = content.replace(/"Authorization": Bearer \$\{token\},\s*/g, '');
    
    // Replace const { token } = useAuth(); with just const {} = useAuth(); (or remove if only token)
    content = content.replace(/const \{ token \} = useAuth\(\);/g, '');
    content = content.replace(/const \{ token, logout \} = useAuth\(\);/g, 'const { logout } = useAuth();');
    
    // We also need to add credentials: 'include' to fetch options
    // Find all fetch calls that pass options.
    // E.g. fetch('/api/...', {
    //   ...
    // })
    // Regex: fetch\(.*?, \{\s*
    // It's easier to just match fetch(..., { and insert credentials: 'include',
    content = content.replace(/fetch\(([^,]+),\s*\{/g, 'fetch(, {\n      credentials: "include",');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
    }
});
