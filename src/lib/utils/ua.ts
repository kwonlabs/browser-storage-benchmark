/**
 * Simple User Agent parser to extract OS (with version) and Browser
 */
export function parseUA(ua: string) {
    let os = "Unknown OS";
    let browser = "Unknown Browser";

    // OS Detection & Version extraction
    if (ua.includes("Win")) {
        os = "Windows";
        const winVer = ua.match(/Windows NT ([\d\.]+)/);
        if (winVer && winVer[1]) {
            if (winVer[1] === "10.0") os = "Windows 10/11";
            else if (winVer[1] === "6.3") os = "Windows 8.1";
            else if (winVer[1] === "6.2") os = "Windows 8";
            else if (winVer[1] === "6.1") os = "Windows 7";
        }
    } else if (ua.includes("Mac")) {
        os = "macOS";
        const macVer = ua.match(/Mac OS X ([\d_]+)/);
        if (macVer && macVer[1]) os = `macOS ${macVer[1].replace(/_/g, '.')}`;
    } else if (ua.includes("Android")) {
        const andVer = ua.match(/Android ([\d\.]+)/);
        os = (andVer && andVer[1]) ? `Android ${andVer[1]}` : "Android";
    } else if (ua.includes("iPhone") || ua.includes("iPad")) {
        const iosVer = ua.match(/OS ([\d_]+)/);
        os = (iosVer && iosVer[1]) ? `iOS ${iosVer[1].replace(/_/g, '.')}` : "iOS";
    } else if (ua.includes("Linux")) {
        os = "Linux";
    }

    // Browser Detection
    if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
    else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
    else if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Opera/") || ua.includes("OPR/")) browser = "Opera";

    return { os, browser };
}

/**
 * Advanced detection using User-Agent Client Hints API (Chromium)
 */
export async function getExtendedUAInfo() {
    const staticInfo = parseUA(navigator.userAgent);

    // @ts-ignore
    if (navigator.userAgentData) {
        try {
            let os = staticInfo.os;

            // @ts-ignore
            if (typeof navigator.userAgentData.getHighEntropyValues === 'function') {
                // @ts-ignore
                const hints = await navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion']);
                if (hints.platform === "Windows") {
                    const majorVer = parseInt(hints.platformVersion.split('.')[0]);
                    if (majorVer >= 13) os = "Windows 11";
                    else if (majorVer > 0) os = `Windows 10 (${hints.platformVersion})`;
                } else if (hints.platform === "macOS") {
                    os = `macOS ${hints.platformVersion || ""}`.trim();
                } else if (hints.platform) {
                    os = `${hints.platform} ${hints.platformVersion || ""}`.trim();
                }
            }

            return {
                os: os,
                browser: staticInfo.browser // Use UA-based detection for browser as well
            };
        } catch (e) {
            // Fallback to static
        }
    }

    return staticInfo;
}

/**
 * Get a full string description of the current environment
 */
export async function getFullEnvironmentInfo() {
    const info = await getExtendedUAInfo();
    const isIsolated = window.crossOriginIsolated ? "Enabled (SAB Ready)" : "Disabled";

    // Feature detection
    const hasWasm = typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function" ? "Supported" : "Not Supported";
    const hasOPFS = typeof navigator.storage?.getDirectory === "function" ? "Available" : "Not Available";

    let sqliteStatus = "Checking...";
    try {
        if (typeof navigator.storage?.getDirectory !== "function") {
            sqliteStatus = "Unsupported (No OPFS API)";
        } else if (!window.crossOriginIsolated) {
            sqliteStatus = "Unsupported (No SAB/Isolation)";
        } else {
            // SQLite's OPFS VFS is synchronous and only initializes in Web Workers.
            // On the main thread, we verify prerequisites (OPFS + SAB).
            sqliteStatus = "Supported (Worker context)";
        }
    } catch (e: any) {
        sqliteStatus = `Error: ${e.message}`;
    }

    return [
        `UA: ${navigator.userAgent}`,
        `OS: ${info.os}`,
        `Browser: ${info.browser}`,
        `WASM: ${hasWasm}`,
        `OPFS: ${hasOPFS}`,
        `SAB: ${isIsolated}`,
        `SQLite: ${sqliteStatus}`
    ].join('\n');
}

/**
 * Format date to YYYY-MM-DD HH:mm
 */
export function formatDate(dateInput: string | number) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "Invalid Date";

    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');

    return `${Y}-${M}-${D} ${h}:${m}`;
}
