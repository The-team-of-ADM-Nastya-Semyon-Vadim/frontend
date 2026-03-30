const SUPABASE_URL = 'https://biyhsdqiuskocypowlsv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeWhzZHFpdXNrb2N5cG93bHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjY1MjMsImV4cCI6MjA4ODA0MjUyM30.BVcy691xYte7JHpuCTEA4DZ0jBaSFVIcvalbN8usyc0';

let supabaseClient = null;

try {
    const sb = globalThis.supabase;
    if (sb && typeof sb.createClient === 'function') {
        supabaseClient = sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (error) {
    console.error('Supabase init:', error);
}

function ensureSupabaseClient() {
    if (supabaseClient) return true;

    try {
        const sb = globalThis.supabase;
        if (sb && typeof sb.createClient === 'function') {
            supabaseClient = sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return true;
        }
    } catch (error) {
        console.error('Supabase re-init:', error);
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
            showFieldError(nameInput, 'Имя должно содержать 2-60 символов.');
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

            if (error) throw error;

            form.reset();
            clearFieldError(nameInput);
            clearFieldError(emailInput);
            setStatus('Спасибо! Вы подписаны.', 'is-success');
        } catch (error) {
            console.error('Subscribe submit:', error);
            setStatus('Не удалось отправить форму. Проверьте данные и попробуйте еще раз.', 'is-error');
        } finally {
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = false;
            }
        }
    });
}

const PRODUCT_IMG_DISPLAY_W = 135;
const PRODUCT_IMG_DISPLAY_H = 100;
const PRODUCT_IMG_FETCH_W = 270;
const PRODUCT_IMG_FETCH_H = 200;
const PRODUCT_IMG_QUALITY = 80;

function encodeStoragePath(path) {
    return path
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

function getSupabasePublicObjectUrl(imagePath) {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    const encoded = encodeStoragePath(imagePath);
    return `${SUPABASE_URL}/storage/v1/object/public/${encoded}`;
}

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

document.addEventListener('DOMContentLoaded', () => {
    ensureSupabaseClient();
    setupSubscribeForm();
});
