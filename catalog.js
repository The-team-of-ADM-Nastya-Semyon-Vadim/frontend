const CAROUSEL_OPTIONS = { speedPxPerSec: 35, resumeAfterMs: 5000 };

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

    function isInteractiveTarget(target) {
        return target instanceof Element
            && Boolean(
                target.closest(
                    'button, a, input, select, textarea, label, [data-add-to-cart="true"], [data-cart-action]'
                )
            );
    }

    function getHalfWidth() {
        let width = 0;
        for (let i = 0; i < originals.length; i++) {
            width += originals[i].getBoundingClientRect().width;
        }
        const styles = getComputedStyle(grid);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        width += gap * Math.max(0, originals.length - 1);
        return width;
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

    function onPointerDown(event) {
        if (isInteractiveTarget(event.target)) return;
        pauseIndefinitely();
        isDragging = true;
        grid.classList.add('is-dragging');
        grid.setPointerCapture?.(event.pointerId);
        dragStartX = event.clientX;
        dragStartScrollLeft = grid.scrollLeft;
    }

    function onPointerMove(event) {
        if (!isDragging) return;
        const dx = event.clientX - dragStartX;
        grid.scrollLeft = dragStartScrollLeft - dx;
        normalizeScroll();
        pauseTemporarily();
    }

    function onPointerUpOrCancel(event) {
        if (!isDragging) return;
        isDragging = false;
        grid.classList.remove('is-dragging');
        grid.releasePointerCapture?.(event.pointerId);
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
    card.dataset.productCardId = getProductCartId(product);

    const topSection = document.createElement('div');
    topSection.className = 'product-section product-section--top';

    const bottomSection = document.createElement('div');
    bottomSection.className = 'product-section product-section--bottom';

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
        regularSpan.textContent = `${product.price}₽`;

        const saleSpan = document.createElement('span');
        saleSpan.className = 'price-discounted';
        saleSpan.textContent = `${product.sale_price}₽`;

        price.appendChild(regularSpan);
        price.appendChild(saleSpan);
    } else if (product.price != null) {
        const regularSpan = document.createElement('span');
        regularSpan.className = 'price-regular';
        regularSpan.textContent = `${product.price}₽`;
        price.appendChild(regularSpan);
    } else {
        price.textContent = 'Цена по запросу';
    }

    const actionRoot = document.createElement('div');
    actionRoot.dataset.productCardAction = 'true';
    actionRoot.dataset.productId = getProductCartId(product);
    actionRoot.dataset.productName = product.name || 'Товар';
    actionRoot.dataset.productPrice = String(getEffectiveProductPriceValue(product));
    actionRoot.dataset.productImage = product.image_url || '';
    renderProductCardAction(actionRoot);

    topSection.appendChild(imageWrapper);
    topSection.appendChild(title);
    bottomSection.appendChild(price);
    bottomSection.appendChild(actionRoot);

    card.appendChild(topSection);
    card.appendChild(bottomSection);

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
        console.error('Popular products unavailable.');
        return;
    }

    setupInfiniteCarousel(grid, CAROUSEL_OPTIONS);

    const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('isPopular', true);

    teardownInfiniteCarousel(grid);

    if (error) {
        console.error('Popular products load:', error);
        setupInfiniteCarousel(grid, CAROUSEL_OPTIONS);
        return;
    }

    let products = data || [];
    if (products.length % 2 === 1) {
        products = products.slice(0, -1);
    }

    grid.innerHTML = '';
    if (products.length === 0) return;

    products.forEach((product, index) => {
        grid.appendChild(createProductCard(product, index));
    });

    setupInfiniteCarousel(grid, CAROUSEL_OPTIONS);
}

let catalogProductsCache = null;

function setCatalogFiltersDisabled(disabled) {
    document.querySelectorAll('#catalog-filters .catalog-filter-btn').forEach((button) => {
        button.disabled = disabled;
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

function matchesCatalogFilters(product) {
    const root = document.getElementById('catalog-filters');
    if (!root) return true;

    for (const button of root.querySelectorAll('.catalog-filter-btn[data-toggle].is-active')) {
        const key = button.dataset.toggle;
        if (key === 'new' && !(product.is_new === true || product.isNew === true)) return false;
        if (key === 'hit' && product.isPopular !== true) return false;
        if (key === 'sale' && (product.sale_price == null || product.sale_price === '')) return false;
    }

    const activeCategories = root.querySelectorAll('.catalog-filter-btn[data-category].is-active');
    if (activeCategories.length) {
        const wanted = [...activeCategories].map((button) => button.dataset.category);
        const productCategory = String(product.category ?? '').trim();
        if (!wanted.includes(productCategory)) return false;
    }

    const priceButton = root.querySelector('.catalog-filter-btn[data-price-max].is-active');
    if (priceButton) {
        const max = Number(priceButton.dataset.priceMax);
        const effectivePrice = getEffectiveCatalogPrice(product);
        if (Number.isNaN(effectivePrice) || effectivePrice > max) return false;
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
            grid.innerHTML = catalogProductsCache.length === 0
                ? '<p class="catalog-empty">В каталоге пока нет товаров.</p>'
                : '<p class="catalog-noresults" role="status">Ничего не найдено</p>';
            return;
        }

        filtered.forEach((product, index) => {
            grid.appendChild(createProductCard(product, index));
        });
    } catch (error) {
        console.error('Catalog render:', error);
        grid.innerHTML =
            '<p class="catalog-load-error" role="alert">Не удалось отобразить товары. Обновите страницу.</p>';
    }
}

function setupCatalogFilters() {
    const root = document.getElementById('catalog-filters');
    if (!root) return;

    root.addEventListener('click', (event) => {
        const button = event.target.closest('.catalog-filter-btn');
        if (!button || !root.contains(button) || button.disabled || catalogProductsCache === null) {
            return;
        }

        if (button.dataset.toggle || button.dataset.category) {
            event.preventDefault();
            event.stopPropagation();
            button.classList.toggle('is-active');
            applyCatalogFilters();
            return;
        }

        if (button.hasAttribute('data-price-max')) {
            event.preventDefault();
            event.stopPropagation();
            const wasActive = button.classList.contains('is-active');

            root.querySelectorAll('.catalog-filter-btn[data-price-max]').forEach((entry) => {
                entry.classList.remove('is-active');
            });

            if (!wasActive) {
                button.classList.add('is-active');
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
                '<p class="catalog-load-error" role="alert">Не удалось загрузить библиотеку данных. Проверьте интернет и обновите страницу.</p>';
            return;
        }

        const { data, error } = await supabaseClient.from('products').select('*');

        if (error) {
            console.error('Catalog load:', error);
            catalogProductsCache = null;
            grid.innerHTML =
                '<p class="catalog-load-error" role="alert">Не удалось загрузить товары. Попробуйте обновить страницу.</p>';
            return;
        }

        catalogProductsCache = data || [];

        if (catalogProductsCache.length === 0) {
            grid.innerHTML = '<p class="catalog-empty">В каталоге пока нет товаров.</p>';
            return;
        }

        applyCatalogFilters();
    } catch (error) {
        console.error('Catalog:', error);
        catalogProductsCache = null;
        grid.innerHTML =
            '<p class="catalog-load-error" role="alert">Не удалось загрузить товары. Попробуйте обновить страницу.</p>';
    } finally {
        setCatalogFiltersDisabled(false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('product-grid')) {
        loadPopularProducts();
    }
    if (document.getElementById('catalog-grid')) {
        setupCatalogFilters();
        loadCatalogProducts();
    }
});



