const TRANSLATIONS = {
    "Food Tracker": "Rastreador de Comidas",
    "Enter PIN to continue": "Ingrese el PIN para continuar",
    "Incorrect PIN": "PIN incorrecto",
    "Enter": "Entrar",
    "Loading...": "Cargando...",
    "Add to Home Screen for the best experience!": "¡Añadir a la pantalla de inicio para la mejor experiencia!",
    "Install": "Instalar",
    "Today": "Hoy",
    "Prep milk for tomorrow:": "Preparar leche para mañana:",
    "Edit Day": "Editar Día",
    "Schedule": "Horario",
    "Edit": "Editar",
    "Medicines": "Medicamentos",
    "AM": "MAÑANA",
    "EVE": "NOCHE",
    "Behavior Tags": "Etiquetas de Comportamiento",
    "Avoid Lists": "Listas para Evitar",
    "Avoid Supplements": "Evitar Suplementos",
    "Energy Drinks": "Bebidas Energéticas",
    "Excessive Caffeine": "Cafeína Excesiva",
    "Artificial Sweeteners": "Edulcorantes Artificiales",
    "High Sodium Foods": "Alimentos con Mucho Sodio",
    "Fried Foods": "Alimentos Fritos",
    "Processed Meats": "Carnes Procesadas",
    "Trans Fats": "Grasas Trans",
    "Avoid Foods": "Evitar Alimentos",
    "Artificial Flavors": "Saborizantes Artificiales",
    "Preservatives": "Preservantes",
    "Excessive Sugar": "Azúcar Excesiva",
    "Heavy Carbohydrates": "Carbohidratos Pesados",
    "Ultra-processed items": "Artículos Ultra-procesados",
    "Food Coloring": "Colorantes Alimentarios",
    "Syrups and Concentrates": "Jarabes y Concentrados",
    "Sleep Quality": "Calidad del Sueño",
    "Potty Tracker": "Rastreador de Baño",
    "Good": "Bien",
    "Bad": "Mal",
    "Soft": "Suave",
    "Wet": "Líquido",
    "Add with time:": "Añadir con hora:",
    "Daily Notes (Private)": "Notas Diarias (Privadas)",
    "Save Notes": "Guardar Notas",
    "Recent Growth (From Cloud)": "Crecimiento Reciente (Nube)",
    "Height": "Altura",
    "Weight": "Peso",
    "No growth data found.": "No se encontraron datos de crecimiento.",
    "Add Entry": "Añadir Entrada",
    "14-Day Timeline": "Línea de Tiempo de 14 Días",
    "Filter:": "Filtro:",
    "Insights / Anomalies": "Perspectivas / Anomalías",
    "Energy & Arousal": "Energía y Activación",
    "Hyperactive": "Hiperactivo",
    "Restless": "Inquieto",
    "Calm": "Tranquilo",
    "Lethargic": "Letárgico",
    "Tired": "Cansado",
    "Mood & Emotional": "Estado de Ánimo y Emocional",
    "Happy / Giggly": "Feliz / Risueño",
    "Irritable": "Irritable",
    "Aggressive": "Agresivo",
    "Anxious": "Ansioso",
    "Meltdown": "Crisis",
    "Clingy": "Apegado",
    "Social & Communication": "Social y Comunicación",
    "Eye contact good": "Buen contacto visual",
    "Eye contact poor": "Poco contacto visual",
    "Responsive": "Receptivo",
    "Chatty / Vocal": "Hablador / Vocal",
    "Quiet / Withdrawn": "Callado / Retraído",
    "New word/sound": "Nueva palabra/sonido",
    "Focus & Sensory": "Enfoque y Sensorial",
    "Focused": "Enfocado",
    "Distracted": "Distraído",
    "Stimming more than usual": "Más autoestimulación",
    "Stimming less than usual": "Menos autoestimulación",
    "Sensory sensitive": "Sensible sensorial",
    "AM Medicines": "Medicinas de la Mañana",
    "Lunch": "Almuerzo",
    "PM Medicines": "Medicinas de la Tarde",
    "Dinner": "Cena",
    "Evening Medicines": "Medicinas de la Noche",
    "Bedtime": "Hora de Acostarse",
    "Good (Normal)": "Bien (Normal)",
    "Soft (Ok)": "Suave (Regular)",
    "Wet (Bad)": "Líquido (Mal)",
    "Notes for": "Notas para",
    "Cancel": "Cancelar",
    "Close": "Cerrar",
    "None": "Ninguno",
    "Prev": "Ant",
    "Next": "Sig",
    "Report": "Reporte",
    "Dashboard": "Tablero"
};

const DICT_ES = Object.entries(TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);
const REVERSE_TRANSLATIONS = {};
for (const [k, v] of Object.entries(TRANSLATIONS)) { REVERSE_TRANSLATIONS[v] = k; }
const DICT_EN = Object.entries(REVERSE_TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);

// Setup I18N globally
window.I18N = {
    lang: localStorage.getItem('demo_lang') || 'en',

    toggleLanguage: function () {
        this.lang = this.lang === 'en' ? 'es' : 'en';
        localStorage.setItem('demo_lang', this.lang);
        this.updateDOM();
        if (typeof window.updateUI === 'function') {
            window.updateUI(); // Optional, but helps sync some logic
        }
    },

    t: function (key) {
        if (!key) return key;
        if (!key.trim()) return key;

        let result = key;
        const dictToUse = this.lang === 'es' ? DICT_ES : DICT_EN;

        // Exact match (ignoring leading/trailing spaces)
        const trimmed = result.trim();
        for (const [source, target] of dictToUse) {
            if (trimmed === source) {
                return result.replace(source, target);
            }
        }

        // If not exact match, do safe replacement using regex word boundaries to avoid substring corruption (e.g. Edit -> Editarar)
        for (const [source, target] of dictToUse) {
            // Escape source string for safely putting it into a regex
            const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Only apply word boundary \b if the source starts/ends with an alphanumeric character
            const prefix = /^\w/.test(source) ? '\\b' : '';
            const suffix = /\w$/.test(source) ? '\\b' : '';

            const regex = new RegExp(prefix + escapedSource + suffix, 'g');
            if (regex.test(result)) {
                result = result.replace(regex, target);
            }
        }
        return result;
    },

    updateDOM: function () {
        // Translate placeholders
        document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(input => {
            const original = input.getAttribute('data-i18n-src') || input.placeholder;
            if (!input.hasAttribute('data-i18n-src')) {
                input.setAttribute('data-i18n-src', original);
            }
            if (this.lang === 'es') {
                input.placeholder = this.t(original);
            } else {
                input.placeholder = original; // always restore to english directly to be exact
            }
        });

        // Walk text nodes for full bidirectional translation
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            const parent = node.parentElement;
            if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.id === 'langToggleBtn' || parent.classList.contains('med-name'))) {
                continue; // don't translate custom user inputs like med-names if they happen to overlap, though it's unlikely
            }
            if (node.nodeValue.trim().length > 0) {
                textNodes.push(node);
            }
        }

        textNodes.forEach(n => {
            n.nodeValue = this.t(n.nodeValue);
        });

        // Toggle Button Text
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            langBtn.innerHTML = this.lang === 'en' ? '🌎 ES' : '🌎 EN';
            // Optional: apply a visual style when Spanish is active
            if (this.lang === 'es') {
                langBtn.classList.add('lang-active');
            } else {
                langBtn.classList.remove('lang-active');
            }
        }
    }
};

// Initialize translation on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    // Inject the translation toggle button next to dark mode if we can't find it
    const topBar = document.querySelector('.top-bar');
    if (topBar && !document.getElementById('langToggleBtn')) {
        const langBtn = document.createElement('button');
        langBtn.id = 'langToggleBtn';
        langBtn.className = 'lang-toggle';
        langBtn.onclick = () => window.I18N.toggleLanguage();
        // Insert right after dark mode toggle
        const darkToggle = document.querySelector('.dark-toggle');
        if (darkToggle) {
            darkToggle.insertAdjacentElement('afterend', langBtn);
        } else {
            topBar.prepend(langBtn);
        }
    }

    // Process initial DOM
    window.I18N.updateDOM();
});
