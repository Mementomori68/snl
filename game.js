/* ============================================================
   ГЕЙМИФИКАЦИЯ — звёзды, ачивки, прогресс
   ============================================================ */

(function() {
    'use strict';

    // ============ ЗВЁЗДНОЕ НЕБО ============
    function createStarfield() {
        const field = document.createElement('div');
        field.className = 'starfield';
        const count = window.innerWidth < 640 ? 80 : 160;

        for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            if (Math.random() < 0.08) star.classList.add('gold');
            else if (Math.random() < 0.15) star.classList.add('blue');

            const size = Math.random() * 2.2 + 0.8;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = (Math.random() * 4) + 's';
            star.style.animationDuration = (2 + Math.random() * 3) + 's';

            field.appendChild(star);
        }
        document.body.insertBefore(field, document.body.firstChild);
    }

    // ============ ЛУНА ============
    function createMoon() {
        const moon = document.createElement('div');
        moon.className = 'moon';
        document.body.appendChild(moon);
    }

    // ============ СЧЁТЧИК ЗВЁЗД ============
    let stars = parseInt(localStorage.getItem('fy_stars') || '0', 10);

    function createStarCounter() {
        const counter = document.createElement('div');
        counter.className = 'star-counter';
        counter.id = 'star-counter';
        counter.title = 'Клик по небу — поймать звезду';
        counter.innerHTML = `<span class="icon">⭐</span><span id="star-count">${stars}</span>`;
        counter.addEventListener('click', openAchievementsPanel);
        document.body.appendChild(counter);
    }

    function updateStarCounter() {
        const el = document.getElementById('star-count');
        if (el) el.textContent = stars;
    }

    // ============ ЛЕТЯЩИЕ ЗВЁЗДЫ ПРИ КЛИКЕ ============
    function initStarClick() {
        document.addEventListener('click', function(e) {
            // Не реагируем на клики по интерактивным элементам
            if (e.target.closest('a, button, input, textarea, .achievements-panel, .star-counter, #auth-modal')) return;

            const star = document.createElement('div');
            star.className = 'flying-star';
            star.textContent = '✦';
            star.style.left = e.clientX + 'px';
            star.style.top = e.clientY + 'px';
            document.body.appendChild(star);

            setTimeout(() => star.remove(), 1000);

            // Увеличиваем счётчик
            stars++;
            localStorage.setItem('fy_stars', stars);
            updateStarCounter();

            // Проверяем ачивки
            checkStarAchievements();
        });
    }

    // ============ АЧИВКИ ============
    const ACHIEVEMENTS = {
        'first-star':    { icon: '🌟', title: 'Первая звезда',   desc: 'Поймать первую звезду' },
        'ten-stars':     { icon: '✨', title: 'Звездолов',       desc: 'Поймать 10 звёзд' },
        'fifty-stars':   { icon: '🌠', title: 'Космонавт',       desc: 'Поймать 50 звёзд' },
        'hundred-stars': { icon: '🌌', title: 'Хранитель звёзд', desc: 'Поймать 100 звёзд' },
        'snl-visited':   { icon: '☀️', title: 'Тёплые дни',      desc: 'Побывать в СНЛ' },
        'cnp-visited':   { icon: '🎨', title: 'Дух улиц',        desc: 'Побывать в CNP' },
        'future-visited':{ icon: '❓', title: 'Любопытный',       desc: 'Открыть третий проект' },
        'explorer':      { icon: '🏆', title: 'Исследователь',   desc: 'Побывать на всех страницах' },
        'guest-star':    { icon: '👤', title: 'Свой человек',    desc: 'Войти в аккаунт' }
    };

    function getUnlocked() {
        try {
            return JSON.parse(localStorage.getItem('fy_achievements') || '[]');
        } catch { return []; }
    }

    function saveUnlocked(arr) {
        localStorage.setItem('fy_achievements', JSON.stringify(arr));
    }

    function unlock(key) {
        const unlocked = getUnlocked();
        if (unlocked.includes(key)) return false;

        unlocked.push(key);
        saveUnlocked(unlocked);

        const ach = ACHIEVEMENTS[key];
        if (ach) showAchievementToast(ach);
        updateProgress();
        return true;
    }

    function showAchievementToast(ach) {
        let container = document.querySelector('.achievements-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'achievements-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
            <div class="ach-icon">${ach.icon}</div>
            <div class="ach-info">
                <div class="ach-title">${ach.title}</div>
                <div class="ach-desc">${ach.desc}</div>
            </div>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    function checkStarAchievements() {
        if (stars >= 1) unlock('first-star');
        if (stars >= 10) unlock('ten-stars');
        if (stars >= 50) unlock('fifty-stars');
        if (stars >= 100) unlock('hundred-stars');
    }

    // ============ ПРОГРЕСС ИССЛЕДОВАНИЯ ============
    function getVisitedPages() {
        try {
            return JSON.parse(localStorage.getItem('fy_pages') || '[]');
        } catch { return []; }
    }

    function markPageVisited(pageName) {
        const pages = getVisitedPages();
        if (!pages.includes(pageName)) {
            pages.push(pageName);
            localStorage.setItem('fy_pages', JSON.stringify(pages));
        }

        // Ачивки за страницы
        if (pageName === 'snl') unlock('snl-visited');
        if (pageName === 'cnp') unlock('cnp-visited');
        if (pageName === 'future') unlock('future-visited');

        // Все страницы
        const allPages = ['index', 'snl', 'cnp', 'future'];
        if (allPages.every(p => pages.includes(p))) unlock('explorer');

        updateProgress();
    }

    function updateProgress() {
        const fill = document.getElementById('progress-fill');
        if (!fill) return;

        const total = Object.keys(ACHIEVEMENTS).length;
        const unlocked = getUnlocked().length;
        const percent = Math.round((unlocked / total) * 100);

        fill.style.width = percent + '%';
    }

    function createProgressBar() {
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.innerHTML = '<div class="progress-fill" id="progress-fill"></div>';
        document.body.appendChild(bar);
        updateProgress();
    }

    // ============ ПАНЕЛЬ АЧИВОК ============
    function createAchievementsPanel() {
        const panel = document.createElement('div');
        panel.className = 'achievements-panel';
        panel.id = 'achievements-panel';

        const unlocked = getUnlocked();

        let itemsHtml = '';
        for (const [key, ach] of Object.entries(ACHIEVEMENTS)) {
            const isUnlocked = unlocked.includes(key);
            itemsHtml += `
                <div class="achievement-item ${isUnlocked ? 'unlocked' : ''}">
                    <div class="icon">${isUnlocked ? ach.icon : '🔒'}</div>
                    <div class="info">
                        <h4>${ach.title}</h4>
                        <p>${ach.desc}</p>
                    </div>
                </div>
            `;
        }

        panel.innerHTML = `
            <button class="panel-close" onclick="closeAchievementsPanel()">×</button>
            <h2>🏆 Достижения</h2>
            <p style="color:var(--text-dim); font-size:0.85rem; margin-bottom:1.2rem;">
                Открыто: ${unlocked.length} из ${Object.keys(ACHIEVEMENTS).length}
            </p>
            ${itemsHtml}
        `;

        document.body.appendChild(panel);
    }

    window.openAchievementsPanel = function() {
        const panel = document.getElementById('achievements-panel');
        if (panel) panel.classList.add('open');
    };

    window.closeAchievementsPanel = function() {
        const panel = document.getElementById('achievements-panel');
        if (panel) panel.classList.remove('open');
    };

    // ============ ПУБЛИЧНОЕ API ============
    window.Game = {
        unlock: unlock,
        markPage: markPageVisited,
        onLogin: function() { unlock('guest-star'); }
    };

    // ============ ИНИЦИАЛИЗАЦИЯ ============
    function init() {
        createStarfield();
        createMoon();
        createProgressBar();
        createStarCounter();
        createAchievementsPanel();
        initStarClick();
        checkStarAchievements();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();