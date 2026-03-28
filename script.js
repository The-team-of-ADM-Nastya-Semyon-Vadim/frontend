const SUPABASE_URL = 'https://biyhsdqiuskocypowlsv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeWhzZHFpdXNrb2N5cG93bHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjY1MjMsImV4cCI6MjA4ODA0MjUyM30.BVcy691xYte7JHpuCTEA4DZ0jBaSFVIcvalbN8usyc0';

/** UMD может повесить клиент на globalThis.supabase; без try/catalog падает весь script.js */
let supabaseClient = null;
try {
    const sb = globalThis.supabase;
    if (sb && typeof sb.createClient === 'function') {
        supabaseClient = sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.error('Инициализация Supabase:', e);
}

function ensureSupabaseClient() {
    if (supabaseClient) return true;
    try {
        const sb = globalThis.supabase;
        if (sb && typeof sb.createClient === 'function') {
            supabaseClient = sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return true;
        }
    } catch (e) {
        console.error('Повторная инициализация Supabase:', e);
    }
    return false;
}

function normalizeLeadName(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isValidLeadName(value) {
    return /^[A-Za-zА-Яа-яЁё\s'-]{2,60}$/.test(value);
}

function isValidLeadEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function setupSubscribeForm() {
    const form = document.getElementById('subscribe-form');
    if (!form) return;

    const nameInput = form.elements.namedItem('name');
    const emailInput = form.elements.namedItem('email');
    const submitButton = form.querySelector('.subscribe-form__submit');
    const status = document.getElementById('subscribe-form-status');

    if (!(nameInput instanceof HTMLInputElement) || !(emailInput instanceof HTMLInputElement)) {
        return;
    }

    nameInput.required = true;
    nameInput.minLength = 2;
    nameInput.maxLength = 60;
    emailInput.required = true;
    emailInput.inputMode = 'email';

    function setStatus(message, type = '') {
        if (!status) return;
        status.textContent = message;
        status.classList.remove('is-error', 'is-success');
        if (type) status.classList.add(type);
    }

    function clearFieldError(input) {
        input.setCustomValidity('');
        input.classList.remove('is-invalid');
    }

    function showFieldError(input, message) {
        input.setCustomValidity(message);
        input.classList.add('is-invalid');
    }

    function validateForm({ report = false } = {}) {
        const normalizedName = normalizeLeadName(nameInput.value);
        const normalizedEmail = String(emailInput.value || '').trim().toLowerCase();

        nameInput.value = normalizedName;
        emailInput.value = normalizedEmail;

        clearFieldError(nameInput);
        clearFieldError(emailInput);

        let firstInvalidField = null;

        if (!normalizedName) {
            showFieldError(nameInput, 'Введите имя.');
            firstInvalidField = firstInvalidField || nameInput;
        } else if (!isValidLeadName(normalizedName)) {
            showFieldError(nameInput, 'Имя должно содержать 2-60 символов: буквы, пробел, дефис или апостроф.');
            firstInvalidField = firstInvalidField || nameInput;
        }

        if (!normalizedEmail) {
            showFieldError(emailInput, 'Введите email.');
            firstInvalidField = firstInvalidField || emailInput;
        } else if (!isValidLeadEmail(normalizedEmail)) {
            showFieldError(emailInput, 'Введите корректный email.');
            firstInvalidField = firstInvalidField || emailInput;
        }

        if (firstInvalidField) {
            setStatus(firstInvalidField.validationMessage, 'is-error');
            if (report) firstInvalidField.reportValidity();
            return null;
        }

        setStatus('');
        return {
            name: normalizedName,
            email: normalizedEmail,
        };
    }

    [nameInput, emailInput].forEach((input) => {
        input.addEventListener('input', () => {
            clearFieldError(input);
            if (status?.classList.contains('is-error')) {
                setStatus('');
            }
        });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = validateForm({ report: true });
        if (!formData) return;

        if (!ensureSupabaseClient()) {
            setStatus('Не удалось подключиться к базе данных. Попробуйте позже.', 'is-error');
            return;
        }

        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = true;
        }
        setStatus('Отправляем данные...', '');

        try {
            const { error } = await supabaseClient.from('leads').insert([
                {
                    name: formData.name,
                    email: formData.email,
                    created_at: new Date().toISOString(),
                },
            ]);

            if (error) {
                throw error;
            }

            form.reset();
            clearFieldError(nameInput);
            clearFieldError(emailInput);
            setStatus('Спасибо! Вы подписаны.', 'is-success');
        } catch (error) {
            console.error('Ошибка отправки подписки в Supabase:', error);
            setStatus('Не удалось отправить форму. Проверьте данные и попробуйте ещё раз.', 'is-error');
        } finally {
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = false;
            }
        }
    });
}

const CAROUSEL_OPTIONS = { speedPxPerSec: 35, resumeAfterMs: 5000 };

/** Макс. размер картинки в карточке ~206×179; грузим ~2× для retina через transform */
const PRODUCT_IMG_DISPLAY_W = 135;
const PRODUCT_IMG_DISPLAY_H = 100;
const PRODUCT_IMG_FETCH_W = 270;
const PRODUCT_IMG_FETCH_H = 200;
const PRODUCT_IMG_QUALITY = 80;
/** Не передаём format=webp: на части проектов Supabase отвечает 400 (allowed values). Ресайз+quality работают без format. */

function encodeStoragePath(path) {
    return path
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

/**
 * Прямая ссылка на объект в Storage (без ресайза).
 */
function getSupabasePublicObjectUrl(imagePath) {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    const encoded = encodeStoragePath(imagePath);
    return `${SUPABASE_URL}/storage/v1/object/public/${encoded}`;
}

/**
 * Оптимизированное превью через Image Transformation (меньше байт, быстрее LCP).
 * Если в проекте не включены трансформации — сработает onerror → fallback на object URL.
 */
function getSupabaseOptimizedImageUrl(imagePath) {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    const encoded = encodeStoragePath(imagePath);
    const params = new URLSearchParams({
        width: String(PRODUCT_IMG_FETCH_W),
        height: String(PRODUCT_IMG_FETCH_H),
        resize: 'contain',
        quality: String(PRODUCT_IMG_QUALITY),
    });
    return `${SUPABASE_URL}/storage/v1/render/image/public/${encoded}?${params.toString()}`;
}

/**
 * @param {string | null | undefined} imagePath
 * @returns {{ src: string, fallbackSrc: string | null }}
 */
function getProductImageSources(imagePath) {
    if (!imagePath) {
        return { src: 'img/product-placeholder.png', fallbackSrc: null };
    }
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return { src: imagePath, fallbackSrc: null };
    }
    const optimized = getSupabaseOptimizedImageUrl(imagePath);
    const fallback = getSupabasePublicObjectUrl(imagePath);
    return {
        src: optimized || 'img/product-placeholder.png',
        fallbackSrc: fallback && fallback !== optimized ? fallback : null,
    };
}

function teardownInfiniteCarousel(grid) {
    if (grid._carouselCleanup) {
        grid._carouselCleanup();
        grid._carouselCleanup = null;
    }
    grid.querySelectorAll('[data-carousel-clone="true"]').forEach((el) => el.remove());
}

function setupInfiniteCarousel(grid, options = {}) {
    teardownInfiniteCarousel(grid);

    const speedPxPerSec = options.speedPxPerSec ?? 30;
    const resumeAfterMs = options.resumeAfterMs ?? 5000;

    const originals = Array.from(grid.children);
    if (originals.length === 0) return;

    originals.forEach((el) => {
        const clone = el.cloneNode(true);
        clone.setAttribute('data-carousel-clone', 'true');
        grid.appendChild(clone);
    });

    let rafId = null;
    let lastTs = 0;
    let isPaused = false;
    let resumeTimer = null;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartScrollLeft = 0;

    function getHalfWidth() {
        let w = 0;
        for (let i = 0; i < originals.length; i++) {
            w += originals[i].getBoundingClientRect().width;
        }
        const styles = getComputedStyle(grid);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        w += gap * Math.max(0, originals.length - 1);
        return w;
    }

    function normalizeScroll() {
        const half = getHalfWidth();
        if (!half) return;
        if (grid.scrollLeft >= half) {
            grid.scrollLeft -= half;
        } else if (grid.scrollLeft < 0) {
            grid.scrollLeft += half;
        }
    }

    function tick(ts) {
        if (!lastTs) lastTs = ts;
        const dt = (ts - lastTs) / 1000;
        lastTs = ts;

        if (!isPaused && !isDragging) {
            grid.scrollLeft += speedPxPerSec * dt;
            normalizeScroll();
        }

        rafId = requestAnimationFrame(tick);
    }

    function pauseTemporarily() {
        isPaused = true;
        if (resumeTimer) clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => {
            isPaused = false;
        }, resumeAfterMs);
    }

    function pauseIndefinitely() {
        isPaused = true;
        if (resumeTimer) clearTimeout(resumeTimer);
        resumeTimer = null;
    }

    function onPointerDown(e) {
        pauseIndefinitely();
        isDragging = true;
        grid.classList.add('is-dragging');
        grid.setPointerCapture?.(e.pointerId);
        dragStartX = e.clientX;
        dragStartScrollLeft = grid.scrollLeft;
    }

    function onPointerMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        grid.scrollLeft = dragStartScrollLeft - dx;
        normalizeScroll();
        pauseTemporarily();
    }

    function onPointerUpOrCancel(e) {
        if (!isDragging) return;
        isDragging = false;
        grid.classList.remove('is-dragging');
        grid.releasePointerCapture?.(e.pointerId);
        pauseTemporarily();
    }

    function onClick() {
        pauseTemporarily();
    }

    function onScroll() {
        if (isDragging) normalizeScroll();
    }

    grid.style.overflowX = 'auto';
    grid.style.scrollBehavior = 'auto';
    grid.addEventListener('pointerdown', onPointerDown);
    grid.addEventListener('pointermove', onPointerMove);
    grid.addEventListener('pointerup', onPointerUpOrCancel);
    grid.addEventListener('pointercancel', onPointerUpOrCancel);
    grid.addEventListener('click', onClick);
    grid.addEventListener('scroll', onScroll, { passive: true });

    rafId = requestAnimationFrame(tick);

    grid._carouselCleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        if (resumeTimer) clearTimeout(resumeTimer);
        grid.removeEventListener('pointerdown', onPointerDown);
        grid.removeEventListener('pointermove', onPointerMove);
        grid.removeEventListener('pointerup', onPointerUpOrCancel);
        grid.removeEventListener('pointercancel', onPointerUpOrCancel);
        grid.removeEventListener('click', onClick);
        grid.removeEventListener('scroll', onScroll);
    };
}

function createProductCard(product, index) {
    const card = document.createElement('div');
    card.className = 'product product--enter';
    card.style.animationDelay = `${index * 70}ms`;

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'product-image-wrapper';

    const img = document.createElement('img');
    const { src, fallbackSrc } = getProductImageSources(product.image_url);
    img.src = src;
    img.alt = product.name || 'Товар';
    img.decoding = 'async';
    img.draggable = false;
    img.width = PRODUCT_IMG_DISPLAY_W;
    img.height = PRODUCT_IMG_DISPLAY_H;
    img.sizes = `${PRODUCT_IMG_DISPLAY_W}px`;

    if (index < 3) {
        img.loading = 'eager';
        if ('fetchPriority' in img) img.fetchPriority = 'high';
    } else {
        img.loading = 'lazy';
        if ('fetchPriority' in img) img.fetchPriority = 'low';
    }

    const placeholderFallback = 'img/product-placeholder.png';
    img.addEventListener('error', function onImgError() {
        if (fallbackSrc && img.src !== fallbackSrc) {
            img.src = fallbackSrc;
            return;
        }
        if (img.src !== placeholderFallback) {
            img.src = placeholderFallback;
            return;
        }
        img.removeEventListener('error', onImgError);
    });

    imageWrapper.appendChild(img);

    const title = document.createElement('h4');
    const titleText = product.name || 'Без названия';
    title.textContent = titleText;
    title.setAttribute('title', titleText);

    const price = document.createElement('div');
    price.className = 'price';

    const hasSalePrice = product.sale_price !== null && product.sale_price !== undefined;

    if (hasSalePrice && product.price != null) {
        const regularSpan = document.createElement('span');
        regularSpan.className = 'price-regular--old';
        regularSpan.textContent = product.price + ' ₽';

        const saleSpan = document.createElement('span');
        saleSpan.className = 'price-sale';
        saleSpan.textContent = product.sale_price + ' ₽';

        price.appendChild(regularSpan);
        price.appendChild(saleSpan);
    } else if (product.price != null) {
        const regularSpan = document.createElement('span');
        regularSpan.className = 'price-regular';
        regularSpan.textContent = product.price + ' ₽';
        price.appendChild(regularSpan);
    } else {
        price.textContent = 'Цена по запросу';
    }

    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = 'В корзину';

    card.appendChild(imageWrapper);
    card.appendChild(title);
    card.appendChild(price);
    card.appendChild(button);

    card.addEventListener(
        'animationend',
        () => {
            card.classList.remove('product--enter');
        },
        { once: true }
    );

    return card;
}

async function loadPopularProducts() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    if (!ensureSupabaseClient()) {
        console.error('Supabase не загружен — популярные товары недоступны.');
        return;
    }

    setupInfiniteCarousel(grid, CAROUSEL_OPTIONS);

    const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('isPopular', true);

    teardownInfiniteCarousel(grid);

    if (error) {
        console.error('Ошибка загрузки товаров из Supabase:', error);
        setupInfiniteCarousel(grid, CAROUSEL_OPTIONS);
        return;
    }

    let products = data || [];
    // Нечётное число карточек ломает сетку/карусель — убираем последний товар
    if (products.length % 2 === 1) {
        products = products.slice(0, -1);
    }

    grid.innerHTML = '';

    if (products.length === 0) {
        return;
    }

    products.forEach((product, i) => {
        grid.appendChild(createProductCard(product, i));
    });

    setupInfiniteCarousel(grid, CAROUSEL_OPTIONS);
}

/** Кэш товаров каталога после загрузки из Supabase (для фильтров) */
let catalogProductsCache = null;

function setCatalogFiltersDisabled(disabled) {
    document.querySelectorAll('#catalog-filters .catalog-filter-btn').forEach((b) => {
        b.disabled = disabled;
    });
}

function getEffectiveCatalogPrice(product) {
    if (product.sale_price != null && product.sale_price !== '') {
        return Number(product.sale_price);
    }
    if (product.price != null && product.price !== '') {
        return Number(product.price);
    }
    return NaN;
}

/**
 * Фильтры каталога (поля в БД Supabase):
 * — Новинки: is_new или isNew = true
 * — Хиты: isPopular = true
 * — Со скидкой: sale_price задан
 * — Категория: category совпадает с подписью кнопки (data-category)
 * — Цена: цена (sale_price или price) не превышает выбранный максимум
 */
function matchesCatalogFilters(product) {
    const root = document.getElementById('catalog-filters');
    if (!root) return true;

    for (const btn of root.querySelectorAll('.catalog-filter-btn[data-toggle].is-active')) {
        const key = btn.dataset.toggle;
        if (key === 'new') {
            if (!(product.is_new === true || product.isNew === true)) return false;
        }
        if (key === 'hit') {
            if (product.isPopular !== true) return false;
        }
        if (key === 'sale') {
            if (product.sale_price == null || product.sale_price === '') return false;
        }
    }

    const catActive = root.querySelectorAll('.catalog-filter-btn[data-category].is-active');
    if (catActive.length) {
        const wanted = [...catActive].map((b) => b.dataset.category);
        const pc = String(product.category ?? '').trim();
        if (!wanted.includes(pc)) return false;
    }

    const priceBtn = root.querySelector('.catalog-filter-btn[data-price-max].is-active');
    if (priceBtn) {
        const max = Number(priceBtn.dataset.priceMax);
        const eff = getEffectiveCatalogPrice(product);
        if (Number.isNaN(eff) || eff > max) return false;
    }

    return true;
}

function applyCatalogFilters() {
    const grid = document.getElementById('catalog-grid');
    if (!grid || catalogProductsCache === null) return;

    try {
        const filtered = catalogProductsCache.filter(matchesCatalogFilters);

        grid.innerHTML = '';

        if (filtered.length === 0) {
            if (catalogProductsCache.length === 0) {
                grid.innerHTML =
                    '<p class="catalog-empty">В каталоге пока нет товаров.</p>';
            } else {
                grid.innerHTML =
                    '<p class="catalog-noresults" role="status">Ничего не найдено</p>';
            }
            return;
        }

        filtered.forEach((product, i) => {
            grid.appendChild(createProductCard(product, i));
        });
    } catch (err) {
        console.error('Ошибка при отображении каталога:', err);
        grid.innerHTML =
            '<p class="catalog-load-error" role="alert">Не удалось отобразить товары. Обновите страницу.</p>';
    }
}

function setupCatalogFilters() {
    const root = document.getElementById('catalog-filters');
    if (!root) return;

    root.addEventListener('click', (e) => {
        const btn = e.target.closest('.catalog-filter-btn');
        if (!btn || !root.contains(btn) || btn.disabled) return;
        if (catalogProductsCache === null) return;

        if (btn.dataset.toggle) {
            e.preventDefault();
            e.stopPropagation();
            btn.classList.toggle('is-active');
            btn.setAttribute('aria-pressed', String(btn.classList.contains('is-active')));
            applyCatalogFilters();
            return;
        }

        if (btn.dataset.category) {
            e.preventDefault();
            e.stopPropagation();
            btn.classList.toggle('is-active');
            btn.setAttribute('aria-pressed', String(btn.classList.contains('is-active')));
            applyCatalogFilters();
            return;
        }

        if (btn.hasAttribute('data-price-max')) {
            e.preventDefault();
            e.stopPropagation();
            const wasActive = btn.classList.contains('is-active');
            root.querySelectorAll('.catalog-filter-btn[data-price-max]').forEach((b) => {
                b.classList.remove('is-active');
                b.setAttribute('aria-pressed', 'false');
            });
            if (!wasActive) {
                btn.classList.add('is-active');
                btn.setAttribute('aria-pressed', 'true');
            }
            applyCatalogFilters();
        }
    });
}

async function loadCatalogProducts() {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;

    try {
        if (!ensureSupabaseClient()) {
            catalogProductsCache = null;
            grid.innerHTML =
                '<p class="catalog-load-error" role="alert">Не удалось загрузить библиотеку данных. Проверьте подключение к интернету и обновите страницу.</p>';
            return;
        }

        const { data, error } = await supabaseClient.from('products').select('*');

        if (error) {
            console.error('Ошибка загрузки каталога из Supabase:', error);
            catalogProductsCache = null;
            grid.innerHTML =
                '<p class="catalog-load-error" role="alert">Не удалось загрузить товары. Попробуйте обновить страницу.</p>';
            return;
        }

        catalogProductsCache = data || [];

        if (catalogProductsCache.length === 0) {
            grid.innerHTML =
                '<p class="catalog-empty">В каталоге пока нет товаров.</p>';
            return;
        }

        applyCatalogFilters();
    } catch (err) {
        console.error('Каталог:', err);
        catalogProductsCache = null;
        grid.innerHTML =
            '<p class="catalog-load-error" role="alert">Не удалось загрузить товары. Попробуйте обновить страницу.</p>';
    } finally {
        setCatalogFiltersDisabled(false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ensureSupabaseClient();
    setupSubscribeForm();
    if (document.getElementById('product-grid')) {
        loadPopularProducts();
    }
    if (document.getElementById('catalog-grid')) {
        setupCatalogFilters();
        loadCatalogProducts();
    }
});
