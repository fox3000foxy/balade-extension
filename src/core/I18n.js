// Translations. Texts live in _locales/<lang>/messages.json (Chrome format).
// In the extension, chrome.i18n picks the browser language; elsewhere (demo page),
// the language file is read once, with English as fallback.
//
//   t("key", a, b)      -> text, with $1, $2... replaced
//   plural("key", n)    -> key_one or key_other depending on n (n replaces $1)
//   list("key")         -> array, for texts separated by "|"
//   first(["a", "b"])   -> first key that exists (theme variant, then common text)
//   apply(root)         -> fills elements marked data-i18n, data-i18n-html, data-i18n-attr
(() => {
  const B = window.Balade;
  if (B.I18n) return;

  const api = typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getMessage ? chrome.i18n : null;

  // Outside the extension: root folder, inferred from this file's URL (.../src/core/I18n.js).
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
      xhr.open("GET", `${root}_locales/${code}/messages.json`, false); // once, on first use
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
      // Texts with a little markup (<code>, <kbd>): they come from the extension itself.
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
