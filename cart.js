function normalizeCartFormValue(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isValidCartPersonName(value) {
    return /^[A-Za-zА-Яа-яЁё\s'-]{2,40}$/.test(value);
}

function isValidCartPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
}

function isValidCartAddress(value) {
    return value.length >= 5 && value.length <= 160;
}

const ORDER_RPC_NAME = 'create_order';
const CART_STORAGE_KEY = 'pinkcake-cart-v1';
const CART_DELIVERY_PRICE = 250;

function getReadableOrderErrorMessage(error) {
    if (typeof error?.message === 'string' && error.message.trim()) {
        return error.message.trim();
    }

    return 'Не удалось отправить заказ. Попробуйте еще раз.';
}

function setupCartCheckoutForm() {
    const form = document.getElementById('cart-checkout-form');
    if (!form) return;

    const submitButton = document.getElementById('cart-checkout-submit');
    const status = document.getElementById('cart-form-status');
    const firstNameInput = form.elements.namedItem('first_name');
    const lastNameInput = form.elements.namedItem('last_name');
    const phoneInput = form.elements.namedItem('phone');
    const addressInput = form.elements.namedItem('address');
    const entranceInput = form.elements.namedItem('entrance');
    const aptInput = form.elements.namedItem('apt');
    const intercomInput = form.elements.namedItem('intercom');
    const floorInput = form.elements.namedItem('floor');

    const requiredInputs = [firstNameInput, lastNameInput, phoneInput, addressInput];
    const optionalInputs = [entranceInput, aptInput, intercomInput, floorInput];

    if (
        requiredInputs.some((input) => !(input instanceof HTMLInputElement)) ||
        optionalInputs.some((input) => input && !(input instanceof HTMLInputElement))
    ) {
        return;
    }

    firstNameInput.required = true;
    firstNameInput.minLength = 2;
    firstNameInput.maxLength = 40;
    firstNameInput.autocomplete = 'given-name';

    lastNameInput.required = true;
    lastNameInput.minLength = 2;
    lastNameInput.maxLength = 40;
    lastNameInput.autocomplete = 'family-name';

    phoneInput.required = true;
    phoneInput.inputMode = 'tel';
    phoneInput.autocomplete = 'tel';

    addressInput.required = true;
    addressInput.minLength = 5;
    addressInput.maxLength = 160;
    addressInput.autocomplete = 'street-address';

    [entranceInput, aptInput, intercomInput, floorInput]
        .filter((input) => input instanceof HTMLInputElement)
        .forEach((input) => {
            input.maxLength = 20;
        });

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

    function getCheckoutPayload() {
        const cartItems = getCartItems();
        const totals = getCartTotals(cartItems);
        const firstName = normalizeCartFormValue(firstNameInput.value);
        const lastName = normalizeCartFormValue(lastNameInput.value);
        const phone = String(phoneInput.value || '').trim();
        const address = normalizeCartFormValue(addressInput.value);
        const entrance = normalizeCartFormValue(entranceInput?.value || '');
        const apartment = normalizeCartFormValue(aptInput?.value || '');
        const intercom = normalizeCartFormValue(intercomInput?.value || '');
        const floor = normalizeCartFormValue(floorInput?.value || '');

        return {
            customer: {
                first_name: firstName,
                last_name: lastName,
                full_name: `${firstName} ${lastName}`.trim(),
                phone,
            },
            delivery: {
                address,
                entrance,
                apartment,
                intercom,
                floor,
            },
            items: cartItems.map((item) => {
                const quantity = Number(item.quantity) || 0;
                const unitPrice = Number(item.price) || 0;

                return {
                    product_id: String(item.id || ''),
                    product_name: item.name || 'Товар',
                    quantity,
                    unit_price: unitPrice,
                    line_total: quantity * unitPrice,
                    image_url: item.image_url || '',
                };
            }),
            summary: {
                items_count: totals.itemCount,
                subtotal_amount: totals.subtotal,
                delivery_amount: totals.delivery,
                total_amount: totals.total,
            },
            source: 'website',
            submitted_at: new Date().toISOString(),
        };
    }

    function validateCartForm({ report = false } = {}) {
        const normalizedFirstName = normalizeCartFormValue(firstNameInput.value);
        const normalizedLastName = normalizeCartFormValue(lastNameInput.value);
        const normalizedPhone = String(phoneInput.value || '').trim();
        const normalizedAddress = normalizeCartFormValue(addressInput.value);

        firstNameInput.value = normalizedFirstName;
        lastNameInput.value = normalizedLastName;
        phoneInput.value = normalizedPhone;
        addressInput.value = normalizedAddress;

        requiredInputs.forEach((input) => clearFieldError(input));

        let firstInvalidField = null;

        if (!normalizedFirstName) {
            showFieldError(firstNameInput, 'Введите имя.');
            firstInvalidField = firstInvalidField || firstNameInput;
        } else if (!isValidCartPersonName(normalizedFirstName)) {
            showFieldError(firstNameInput, 'Имя должно содержать 2-40 символов.');
            firstInvalidField = firstInvalidField || firstNameInput;
        }

        if (!normalizedLastName) {
            showFieldError(lastNameInput, 'Введите фамилию.');
            firstInvalidField = firstInvalidField || lastNameInput;
        } else if (!isValidCartPersonName(normalizedLastName)) {
            showFieldError(lastNameInput, 'Фамилия должна содержать 2-40 символов.');
            firstInvalidField = firstInvalidField || lastNameInput;
        }

        if (!normalizedPhone) {
            showFieldError(phoneInput, 'Введите телефон.');
            firstInvalidField = firstInvalidField || phoneInput;
        } else if (!isValidCartPhone(normalizedPhone)) {
            showFieldError(phoneInput, 'Введите корректный телефон.');
            firstInvalidField = firstInvalidField || phoneInput;
        }

        if (!normalizedAddress) {
            showFieldError(addressInput, 'Введите адрес доставки.');
            firstInvalidField = firstInvalidField || addressInput;
        } else if (!isValidCartAddress(normalizedAddress)) {
            showFieldError(addressInput, 'Адрес должен содержать от 5 до 160 символов.');
            firstInvalidField = firstInvalidField || addressInput;
        }

        if (firstInvalidField) {
            setStatus(firstInvalidField.validationMessage, 'is-error');
            if (report) firstInvalidField.reportValidity();
            return false;
        }

        setStatus('');
        return true;
    }

    const allInputs = [...requiredInputs, ...optionalInputs.filter((input) => input instanceof HTMLInputElement)];

    allInputs.forEach((input) => {
        input.addEventListener('input', () => {
            clearFieldError(input);
            if (status?.classList.contains('is-error') || status?.classList.contains('is-success')) {
                setStatus('');
            }
        });
    });

    submitButton?.addEventListener('click', async (event) => {
        event.preventDefault();

        if (getCartItems().length === 0) {
            setStatus('Добавьте товары в корзину перед оформлением.', 'is-error');
            return;
        }

        if (!validateCartForm({ report: true })) {
            return;
        }

        if (!ensureSupabaseClient()) {
            setStatus('Не удалось подключиться к серверу заказа. Попробуйте позже.', 'is-error');
            return;
        }

        const orderPayload = getCheckoutPayload();

        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = true;
        }
        setStatus('Отправляем заказ...', '');
        console.log('Checkout payload object:', orderPayload);
        console.log('Checkout payload JSON:\n' + JSON.stringify(orderPayload, null, 2));
        console.log('Order RPC:', ORDER_RPC_NAME);

        try {
            const { data, error } = await supabaseClient.rpc(ORDER_RPC_NAME, {
                payload: orderPayload,
            });

            if (error) throw error;

            console.log('Checkout response:', data);

            clearCartItems();
            renderCartPage();
            syncProductCardControls();
            form.reset();
            allInputs.forEach((input) => clearFieldError(input));

            const successMessage =
                typeof data?.message === 'string' && data.message.trim()
                    ? data.message.trim()
                    : 'Заказ успешно отправлен.';

            setStatus(successMessage, 'is-success');
        } catch (error) {
            console.error('Order submit:', error);
            console.error('Order RPC:', ORDER_RPC_NAME);
            console.error('Order error details:', {
                name: error?.name,
                message: error?.message,
                context: error?.context,
            });
            setStatus(getReadableOrderErrorMessage(error), 'is-error');
        } finally {
            renderCartPage();
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = false;
            }
        }
    });
}

function getProductCartId(product) {
    return String(product?.id ?? `${product?.name ?? 'product'}::${product?.image_url ?? ''}`);
}

function getEffectiveProductPriceValue(product) {
    if (product?.sale_price != null && product.sale_price !== '') {
        return Number(product.sale_price) || 0;
    }
    if (product?.price != null && product.price !== '') {
        return Number(product.price) || 0;
    }
    return 0;
}

function formatPrice(value) {
    return `${Math.round(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
}

function getCartItems() {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Cart localStorage:', error);
        return [];
    }
}

function saveCartItems(items) {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
        console.error('Save cart:', error);
    }
}

function clearCartItems() {
    saveCartItems([]);
}

function addItemToCart(product) {
    const cartItems = getCartItems();
    const id = getProductCartId(product);
    const existingItem = cartItems.find((item) => item.id === id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cartItems.push({
            id,
            name: product.name || 'Товар',
            price: getEffectiveProductPriceValue(product),
            image_url: product.image_url || '',
            quantity: 1,
        });
    }

    saveCartItems(cartItems);
}

function updateCartItemQuantity(itemId, nextQuantity) {
    const cartItems = getCartItems();
    const nextItems = cartItems
        .map((item) => (item.id !== itemId ? item : { ...item, quantity: nextQuantity }))
        .filter((item) => item.quantity > 0);

    saveCartItems(nextItems);
}

function getCartTotals(items) {
    const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const subtotal = items.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0
    );
    const delivery = itemCount > 0 ? CART_DELIVERY_PRICE : 0;

    return {
        itemCount,
        subtotal,
        delivery,
        total: subtotal + delivery,
    };
}

function getItemCountLabel(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) return `${count} товар`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} товара`;
    return `${count} товаров`;
}

function getCartItemQuantity(itemId) {
    const item = getCartItems().find((entry) => entry.id === itemId);
    return item ? Number(item.quantity) || 0 : 0;
}

function createQuantityControl(itemId, quantity) {
    const quantityControl = document.createElement('div');
    quantityControl.className = 'quantity';

    const decreaseButton = document.createElement('button');
    decreaseButton.type = 'button';
    decreaseButton.textContent = '−';
    decreaseButton.setAttribute('aria-label', 'Уменьшить количество');
    decreaseButton.dataset.cartAction = 'decrease';
    decreaseButton.dataset.cartId = itemId;

    const quantityValue = document.createElement('span');
    quantityValue.textContent = String(quantity);

    const increaseButton = document.createElement('button');
    increaseButton.type = 'button';
    increaseButton.textContent = '+';
    increaseButton.setAttribute('aria-label', 'Увеличить количество');
    increaseButton.dataset.cartAction = 'increase';
    increaseButton.dataset.cartId = itemId;

    quantityControl.appendChild(decreaseButton);
    quantityControl.appendChild(quantityValue);
    quantityControl.appendChild(increaseButton);

    return quantityControl;
}

function renderProductCardAction(actionRoot) {
    if (!(actionRoot instanceof HTMLElement)) return;

    const productId = actionRoot.dataset.productId || '';
    const quantity = getCartItemQuantity(productId);
    actionRoot.innerHTML = '';

    if (quantity > 0) {
        actionRoot.appendChild(createQuantityControl(productId, quantity));
        return;
    }

    const button = document.createElement('button');
    button.className = 'btn';
    button.type = 'button';
    button.dataset.addToCart = 'true';
    button.dataset.productId = productId;
    button.dataset.productName = actionRoot.dataset.productName || 'Товар';
    button.dataset.productPrice = actionRoot.dataset.productPrice || '0';
    button.dataset.productImage = actionRoot.dataset.productImage || '';
    button.textContent = 'В корзину';

    actionRoot.appendChild(button);
}

function syncProductCardControls() {
    document.querySelectorAll('[data-product-card-action]').forEach((actionRoot) => {
        renderProductCardAction(actionRoot);
    });
}

function createCartItemCard(item) {
    const card = document.createElement('div');
    card.className = 'product';

    const topSection = document.createElement('div');
    topSection.className = 'product-section product-section--top';

    const bottomSection = document.createElement('div');
    bottomSection.className = 'product-section product-section--bottom';

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'product-image-wrapper';

    const img = document.createElement('img');
    const { src, fallbackSrc } = getProductImageSources(item.image_url);
    img.src = src;
    img.alt = item.name || 'Товар';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = PRODUCT_IMG_DISPLAY_W;
    img.height = PRODUCT_IMG_DISPLAY_H;

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
    title.textContent = item.name || 'Товар';
    title.setAttribute('title', item.name || 'Товар');

    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = formatPrice(item.price);

    const quantity = createQuantityControl(item.id, item.quantity);

    topSection.appendChild(imageWrapper);
    topSection.appendChild(title);
    bottomSection.appendChild(price);
    bottomSection.appendChild(quantity);

    card.appendChild(topSection);
    card.appendChild(bottomSection);

    return card;
}

function updateCartSummary(items) {
    const summary = document.querySelector('.cart-summary');
    if (!summary) return;

    const rows = summary.querySelectorAll('.summary-row');
    const totalRow = summary.querySelector('.summary-total');
    const submitButton = summary.querySelector('.btn');

    if (rows.length < 2 || !totalRow) return;

    const totals = getCartTotals(items);
    const [itemsRow, deliveryRow] = rows;
    const itemsRowSpans = itemsRow.querySelectorAll('span');
    const deliveryRowSpans = deliveryRow.querySelectorAll('span');
    const totalRowSpans = totalRow.querySelectorAll('span');

    if (itemsRowSpans.length >= 2) {
        itemsRowSpans[0].textContent = getItemCountLabel(totals.itemCount);
        itemsRowSpans[1].textContent = formatPrice(totals.subtotal);
    }

    if (deliveryRowSpans.length >= 2) {
        deliveryRowSpans[1].textContent = formatPrice(totals.delivery);
    }

    if (totalRowSpans.length >= 2) {
        totalRowSpans[1].textContent = formatPrice(totals.total);
    }

    if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = totals.itemCount === 0;
    }
}

function renderCartPage() {
    const grid = document.getElementById('cart-grid');
    if (!grid) return;

    const cartItems = getCartItems();
    grid.innerHTML = '';

    if (cartItems.length === 0) {
        grid.innerHTML = '<p class="cart-empty" role="status">Корзина пока пуста.</p>';
        updateCartSummary([]);
        return;
    }

    cartItems.forEach((item) => {
        grid.appendChild(createCartItemCard(item));
    });

    updateCartSummary(cartItems);
}

function setupAddToCartButtons() {
    document.addEventListener('click', (event) => {
        const addButton = event.target.closest('[data-add-to-cart="true"]');
        if (addButton instanceof HTMLButtonElement) {
            addItemToCart({
                id: addButton.dataset.productId || '',
                name: addButton.dataset.productName || 'Товар',
                price: Number(addButton.dataset.productPrice || 0),
                image_url: addButton.dataset.productImage || '',
            });
            syncProductCardControls();
            renderCartPage();
            return;
        }

        const quantityButton = event.target.closest('[data-cart-action][data-cart-id]');
        if (!(quantityButton instanceof HTMLButtonElement)) return;

        const cartId = quantityButton.dataset.cartId;
        const action = quantityButton.dataset.cartAction;
        const cartItems = getCartItems();
        const item = cartItems.find((entry) => entry.id === cartId);
        if (!item) return;

        const nextQuantity = action === 'increase' ? item.quantity + 1 : item.quantity - 1;
        updateCartItemQuantity(cartId, nextQuantity);
        syncProductCardControls();
        renderCartPage();
    });
}

function setupCartPage() {
    syncProductCardControls();
    renderCartPage();
}

document.addEventListener('DOMContentLoaded', () => {
    setupCartCheckoutForm();
    setupAddToCartButtons();
    setupCartPage();
});
