export function parseMarkdownTable(markdown: string) {
  // Regex to match markdown tables
  const tableRegex = /\|(.+)\|(\n\|[-:\s|]+\|\n)((?:\|.+\|\n?)+)/g;
  const matches = [...markdown.matchAll(tableRegex)];
  
  if (matches.length === 0) return null;

  try {
    const chartsData = matches.map(match => {
      const headerRow = match[1];
      const dataRows = match[3].trim().split('\n');

      const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
      if (headers.length < 2) return null;

      const xAxisKey = headers[0];
      const dataKeys = headers.slice(1);

      const data = dataRows.map(row => {
        const cells = row.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        const rowData: any = { [xAxisKey]: cells[0] };
        
        dataKeys.forEach((key, idx) => {
          const val = cells[idx + 1] || '';
          // Strip everything except numbers, dots, and minus signs
          const numStr = val.replace(/[^0-9.-]/g, '');
          
          if (numStr && !isNaN(Number(numStr))) {
            rowData[key] = Number(numStr);
          } else {
            rowData[key] = val;
          }
        });
        
        return rowData;
      });

      // Only return if we actually parsed some numeric data
      const hasNumeric = data.some(d => dataKeys.some(k => typeof d[k] === 'number'));
      if (!hasNumeric) return null;

      return {
        xAxisKey,
        dataKeys,
        data
      };
    });

    const validCharts = chartsData.filter(Boolean);
    return validCharts.length > 0 ? validCharts : null;
  } catch (e) {
    return null;
  }
}
