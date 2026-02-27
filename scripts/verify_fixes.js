import puppeteer from 'puppeteer';

async function runTest() {
    console.log('🚀 Starting Automated Verification...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // 1. Verify Deployment Routing (SPA)
    console.log('Checking SPA Routing...');
    try {
        await page.goto('http://localhost:3535/report', { waitUntil: 'networkidle0' });
        const activeTab = await page.$eval('.tab-content.active', el => el.id);
        if (activeTab === 'tab-report') {
            console.log('✅ SPA Routing verified: Navigated directly to /report');
        } else {
            console.error('❌ SPA Routing failed: Active tab is not tab-report');
        }
    } catch (e) {
        console.error('❌ Routing test error:', e.message);
    }

    // 2. Verify Security Headers (SharedArrayBuffer)
    console.log('Checking Security Headers...');
    const sabEnabled = await page.evaluate(() => typeof SharedArrayBuffer !== 'undefined');
    if (sabEnabled) {
        console.log('✅ Security Headers verified: SharedArrayBuffer is available');
    } else {
        console.error('❌ Security Headers failed: SharedArrayBuffer is MISSING');
    }

    // 3. Verify Storage Quota Handling (10MB)
    console.log('Checking 10MB Storage Quota Handling...');
    try {
        // Collect console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        // Open advanced panel
        await page.click('#btn-toggle-advanced');
        await new Promise(r => setTimeout(r, 500));

        // Select only Native -> 10MB
        await page.evaluate(() => {
            (document.getElementById('cat-none')).click();
            (document.getElementById('size-none')).click();
            document.querySelector('input[value="native"]').checked = true;
            document.querySelector('input[value="10mb"]').checked = true;
        });

        // Run
        await page.click('#btn-report-run');

        // Wait for completion (100% progress)
        await page.waitForFunction(() => {
            const el = document.getElementById('progress-percent');
            return el && el.innerText.includes('100%');
        }, { timeout: 30000 });

        const quotaErrors = consoleErrors.filter(msg => msg.includes('QuotaExceededError'));
        if (quotaErrors.length === 0) {
            console.log('✅ Quota Handling verified: No QuotaExceededError in console for 10MB test');
        } else {
            console.error('❌ Quota Handling failed: Found QuotaExceededError in console');
        }
    } catch (e) {
        console.error('❌ Quota test error:', e.message);
    }

    await browser.close();
    console.log('🏁 Verification finished.');
}

runTest();
