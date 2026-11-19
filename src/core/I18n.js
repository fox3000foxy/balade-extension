// Traductions. Les textes vivent dans _locales/<langue>/messages.json (format Chrome).
// Dans l'extension, chrome.i18n choisit la langue du navigateur ; ailleurs (page de démo),
// le fichier de la langue est lu une fois, avec l'anglais en secours.
//
//   t("key", a, b)      → texte, avec $1, $2… remplacés
//   plural("key", n)    → key_one ou key_other selon n (n remplace $1)
//   list("key")         → tableau, pour les textes séparés par « | »
//   first(["a", "b"])   → premier texte qui existe (variante d'un thème, puis texte commun)
//   apply(root)         → remplit les éléments marqués data-i18n, data-i18n-html, data-i18n-attr
(() => {
  const B = window.Balade;
  if (B.I18n) return;

  const api = typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getMessage ? chrome.i18n : null;

  // Hors extension : dossier racine, déduit de l'adresse de ce fichier (…/src/core/I18n.js).
  const script = document.currentScript && document.currentScript.src;
  const root = script ? script.replace(/src\/core\/I18n\.js(\?.*)?$/, "") : "";

  const lang = (() => {
    const l = (api ? api.getUILanguage() : navigator.language) || "en";
    return l.toLowerCase().startsWith("fr") ? "fr" : "en";
  })();

  let table = null;

  function readLocale(code) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `${root}_locales/${code}/messages.json`, false); // une seule fois, au premier texte
      xhr.send();
      if (xhr.status && xhr.status !== 200) return {};
      return JSON.parse(xhr.responseText);
    } catch (err) {
      return {};
    }
  }

  function fallbackTable() {
    if (!table) {
      const en = readLocale("en");
      table = lang === "en" ? en : { ...en, ...readLocale(lang) };
      table = Object.fromEntries(Object.entries(table).map(([k, v]) => [k.toLowerCase(), v.message]));
    }
    return table;
  }

  function raw(key) {
    if (api) return api.getMessage(key) || "";
    return fallbackTable()[key.toLowerCase()] || "";
  }

  function fill(text, args) {
    return text.replace(/\$(\d)/g, (m, i) => (args[i - 1] !== undefined ? String(args[i - 1]) : ""));
  }

  const rules = new Intl.PluralRules(lang);

  const I18n = {
    lang,

    has(key) {
      return raw(key) !== "";
    },

    t(key, ...args) {
      const text = raw(key);
      if (!text) return key;
      return api ? api.getMessage(key, args.map(String)) : fill(text, args);
    },

    plural(key, n, ...args) {
      const form = rules.select(n) === "one" ? "one" : "other";
      return I18n.t(`${key}_${form}`, n, ...args);
    },

    list(key) {
      return I18n.t(key).split("|").map((s) => s.trim()).filter(Boolean);
    },

    first(keys, ...args) {
      const key = keys.find((k) => I18n.has(k));
      return key ? I18n.t(key, ...args) : keys[keys.length - 1];
    },

    apply(root = document) {
      if (root === document) document.documentElement.lang = lang;
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = I18n.t(el.dataset.i18n);
      });
      // Textes avec un peu de balisage (<code>, <kbd>) : ils viennent de l'extension elle-même.
      root.querySelectorAll("[data-i18n-html]").forEach((el) => {
        el.innerHTML = I18n.t(el.dataset.i18nHtml);
      });
      // data-i18n-attr="placeholder:key; aria-label:key"
      root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
        for (const pair of el.dataset.i18nAttr.split(";")) {
          const [attr, key] = pair.split(":").map((s) => s.trim());
          if (attr && key) el.setAttribute(attr, I18n.t(key));
        }
      });
    }
  };

  B.I18n = I18n;
})();
