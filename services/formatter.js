/**
 * WhatsApp Formatter Service
 * Converts structured AI JSON into WhatsApp-friendly text based on strict rules.
 */

const formatResponse = (aiData, options = {}) => {
    if (!aiData) return "No data available.";

    let responseParts = [];

    // --- 1. HYBRID PARSING LOGIC ---
    let metricsBlock = [];
    let tablesBlock = [];
    let chartsBlock = [];
    let summaryText = "";
    let suggestions = [];

    // Case A: New Block Format (answer.blocks)
    if (aiData.answer) {
        if (aiData.answer.summary) {
            summaryText = aiData.answer.summary;
        }

        if (aiData.answer.blocks && Array.isArray(aiData.answer.blocks)) {
            aiData.answer.blocks.forEach(block => {
                if (block.type === 'metrics') {
                    // Start of metrics handling
                    if (block.metrics) metricsBlock = block.metrics;
                }
                else if (block.type === 'table') {
                    // Push individual table block to array
                    tablesBlock.push(block);
                }
                else if (block.type === 'chart') {
                    chartsBlock.push(block);
                }
                else if (block.type === 'suggestions') {
                    if (block.items) suggestions = block.items;
                }
            });
        }
    }
    // Case B: Legacy Flat Format
    else {
        metricsBlock = aiData.metrics || [];
        tablesBlock = aiData.tables || [];
        chartsBlock = aiData.charts || [];
        summaryText = aiData.text || "";
        suggestions = aiData.suggestions || [];
    }

    // --- 2. RENDER SECTIONS ---

    // A. Metrics (Key Stats)
    if (metricsBlock && metricsBlock.length > 0) {
        const limitedMetrics = metricsBlock.slice(0, 5);
        const metricsText = limitedMetrics.map(m => `*${m.label || m.name}:* ${m.value}`).join('\n');
        responseParts.push(`*📊 Key Metrics:*\n${metricsText}`);
    }

    // B. Tables (Detailed Data)
    if (!options.omitTables && tablesBlock && tablesBlock.length > 0) {
        tablesBlock.forEach((table, index) => {
            let tableStr = `*📋 Table ${index + 1}${table.title ? ': ' + table.title : ''}*`;
            if (table.headers) {
                tableStr += `\n_${table.headers.join(' | ')}_`;
            }
            if (table.rows && Array.isArray(table.rows)) {
                const top3 = table.rows.slice(0, 3);
                top3.forEach(row => {
                    // Ensure row elements are strings
                    tableStr += `\n${row.map(c => String(c)).join(' | ')}`;
                });
                if (table.rows.length > 3) {
                    tableStr += `\n_(+${table.rows.length - 3} more rows)_`;
                }
            }
            responseParts.push(tableStr);
        });
    }

    // C. Charts (Visualized as ASCII Bars)
    if (chartsBlock && chartsBlock.length > 0) {
        chartsBlock.forEach((chart, index) => {
            let chartStr = `*📈 Chart ${index + 1}${chart.title ? ': ' + chart.title : ''}*`;

            // Attempt to render ASCII bars if data points exist
            if (chart.data && Array.isArray(chart.data)) {
                chartStr += '\n';
                const maxVal = Math.max(...chart.data.map(d => Number(d.value) || 0));
                const barLength = 10;

                chart.data.slice(0, 5).forEach(d => {
                    const val = Number(d.value) || 0;
                    const filledLen = maxVal > 0 ? Math.round((val / maxVal) * barLength) : 0;
                    const bar = '█'.repeat(filledLen) + '░'.repeat(barLength - filledLen);
                    chartStr += `${d.label}: ${bar} (${d.value})\n`;
                });
            }

            // Add the trend summary if available
            if (chart.trend_summary || chart.description) {
                chartStr += `_Trend: ${chart.trend_summary || chart.description}_`;
            }

            responseParts.push(chartStr);
        });
    }

    // D. Overview (Summary)
    if (summaryText) {
        responseParts.push(`*📝 Overview:*\n${summaryText.trim()}`);
    }

    // --- 3. RETURN OBJECT ---
    return {
        body: responseParts.join('\n\n────────────────\n\n'),
        suggestions: suggestions
    };
};

module.exports = { formatResponse };
