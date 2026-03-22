const SUPABASE_URL = 'https://biyhsdqiuskocypowlsv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeWhzZHFpdXNrb2N5cG93bHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjY1MjMsImV4cCI6MjA4ODA0MjUyM30.BVcy691xYte7JHpuCTEA4DZ0jBaSFVIcvalbN8usyc0';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CAROUSEL_OPTIONS = { speedPxPerSec: 35, resumeAfterMs: 5000 };

function getImageUrl(imagePath) {
    if (!imagePath) {
        return 'img/product-placeholder.png';
    }

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }

    const base = `${SUPABASE_URL}/storage/v1/object/public/`;
    return base + imagePath.replace(/^\/+/, '');
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
    img.src = getImageUrl(product.image_url);
    img.alt = product.name || 'Товар';
    imageWrapper.appendChild(img);

    const title = document.createElement('h4');
    title.textContent = product.name || 'Без названия';

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

    const products = data || [];

    grid.innerHTML = '';

    if (products.length === 0) {
        return;
    }

    products.forEach((product, i) => {
        grid.appendChild(createProductCard(product, i));
    });

    setupInfiniteCarousel(grid, CAROUSEL_OPTIONS);
}

document.addEventListener('DOMContentLoaded', loadPopularProducts);
