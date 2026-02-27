import { addLog } from './ui';

export function switchToTab(targetId: string) {
    // Clear all actives
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Set new active content
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
        targetContent.classList.add('active');
        document.body.classList.toggle('is-404', targetId === 'tab-404');
    } else {
        console.error('Target tab content not found:', targetId);
        return;
    }

    // Sync nav button if exists
    document.querySelectorAll('.tab-btn').forEach(b => {
        const btn = b as HTMLElement;
        if (btn.dataset.target === targetId) {
            btn.classList.add('active');
        }
    });
}

export function handleRouting() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';

    if (path === '/' || path === '/index.html') {
        switchToTab('tab-home');
    } else if (path === '/report') {
        switchToTab('tab-report');
    } else {
        // Show 404 Tab
        switchToTab('tab-404');
        addLog(`404: Path not found - ${path}`, 'error');
    }
}

export function initRouter() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = (btn as HTMLElement).dataset.target!;
            const path = target === 'tab-home' ? '/' : '/report';

            switchToTab(target);

            // Update URL (Push state)
            if (window.location.pathname !== path) {
                window.history.pushState({}, '', path);
            }
        });
    });

    // Sync UI on browser back/forward
    window.addEventListener('popstate', () => {
        handleRouting();
    });

    // Restore Tab (URL path) on load
    handleRouting();
}
