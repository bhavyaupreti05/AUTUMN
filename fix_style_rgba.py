import re

def replace_rgba(match):
    r, g, b = [int(x) for x in match.group(1).split(',')]
    alpha = float(match.group(2))
    percent = int(alpha * 100)
    
    var_map = {
        (204, 120, 92): '--accent',
        (166, 93, 70): '--accent-hover'
    }
    var_name = var_map.get((r, g, b))
    if var_name:
        return f'color-mix(in srgb, var({var_name}) {percent}%, transparent)'
    return match.group(0)

with open('frontend/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*,\s*([0-9.]+)\s*\)')
content = pattern.sub(replace_rgba, content)

with open('frontend/style.css', 'w', encoding='utf-8') as f:
    f.write(content)
