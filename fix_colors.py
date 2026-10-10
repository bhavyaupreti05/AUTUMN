import re
import sys

def replace_rgba(match):
    color = match.group(1)
    r, g, b = [int(x) for x in color.split(',')]
    alpha = float(match.group(2))
    percent = int(alpha * 100)
    
    var_map = {
        (250, 82, 82): '--error',
        (76, 175, 80): '--success',
        (251, 191, 36): '--accent'
    }
    var_name = var_map.get((r, g, b))
    if var_name:
        return f'color-mix(in srgb, var({var_name}) {percent}%, transparent)'
    return match.group(0)

with open('frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('#6b7280', 'var(--text-muted)')
content = content.replace('#ff4a4a', 'var(--color-danger)')

pattern = re.compile(r'rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*,\s*([0-9.]+)\s*\)')
content = pattern.sub(replace_rgba, content)

with open('frontend/admin.html', 'w', encoding='utf-8') as f:
    f.write(content)
