/* ==========================================================================
   script.js — shared by every page
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   Each section only runs if its elements exist on the current page.
   ========================================================================== */

(function () {
  "use strict";

  var PRODUCTS_URL = "products.json";
  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbyQDVgdm9uSq1XqBsJd8wO93hl5KQB1hEq4pKiKR7z0w6TBs7ZEtemry8gaTb7ZweHR5g/exec";
  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhsKPmUJNOCKjtWaGh8jkqIfIbiyTO6OrhxNJRu1-UimXAEaRfGEFbr8W-kAKKDRatkiHlTjwkvW_p/pub?gid=0&single=true&output=csv";

  /* ---------- helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // "Herbal Fresh" -> "herbal-fresh"
  function slug(str) {
    return String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-");
  }

  function formatPrice(n) {
    var num = Number(n);
    return (isNaN(num) ? n : num.toLocaleString("th-TH")) + " บาท";
  }

  /* ======================================================================
     1) product.html — product cards + mood filter
     ====================================================================== */

  function initProducts() {
    var list = document.getElementById("product-list");
    var bar = document.getElementById("filter-bar");
    if (!list) return;

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (products) {
        // unique moods, in order of first appearance
        var moods = [];
        products.forEach(function (p) {
          if (p.mood && moods.indexOf(p.mood) === -1) moods.push(p.mood);
        });

        var active = resolveMoodParam(moods);

        function render() {
          list.textContent = "";
          var shown = products.filter(function (p) {
            return active === "all" || p.mood === active;
          });

          if (!shown.length) {
            list.appendChild(el("p", "text-center", "ไม่พบสินค้า"));
            return;
          }
          shown.forEach(function (p) {
            list.appendChild(buildCard(p));
          });
        }

        function renderBar() {
          if (!bar) return;
          bar.textContent = "";
          ["all"].concat(moods).forEach(function (m) {
            var btn = el("button", m === active ? "is-active" : "", m === "all" ? "ทั้งหมด" : m);
            btn.type = "button";
            btn.addEventListener("click", function () {
              active = m;
              renderBar();
              render();
            });
            bar.appendChild(btn);
          });
        }

        renderBar();
        render();
      })
      .catch(function (error) {
        console.error(error);
        list.textContent = "";
        list.appendChild(el("p", "text-center", "โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
      });
  }

  // Turn ?mood=xxx into one of the real mood names (or "all").
  // Matches the whole mood ("herbal-fresh") or any word in it ("fresh"), case-insensitive.
  function resolveMoodParam(moods) {
    var param = slug(new URLSearchParams(window.location.search).get("mood"));
    if (!param || param === "all") return "all";

    var i;
    for (i = 0; i < moods.length; i++) {
      if (slug(moods[i]) === param) return moods[i];
    }
    for (i = 0; i < moods.length; i++) {
      if (slug(moods[i]).split("-").indexOf(param) !== -1) return moods[i];
    }
    return "all";
  }

  function buildCard(p) {
    var card = el("article", "product-card");
    card.setAttribute("data-mood", slug(p.mood));

    var imgWrap = el("div", "product-card__image");
    var img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name;
    img.loading = "lazy";
    imgWrap.appendChild(img);

    var body = el("div", "product-card__body");
    body.appendChild(el("span", "mood", p.mood));
    body.appendChild(el("h3", "product-card__title", p.name));

    var meta = el("div", "product-card__meta");
    meta.appendChild(el("span", "product-card__size", p.size));
    meta.appendChild(el("span", "price", formatPrice(p.price)));

    var itemName = p.name + " " + p.size;
    var link = el("a", "btn btn--block", "สั่งซื้อ");
    link.href =
      "order.html?item=" + encodeURIComponent(itemName) + "&price=" + encodeURIComponent(p.price);

    body.appendChild(meta);
    body.appendChild(link);

    card.appendChild(imgWrap);
    card.appendChild(body);
    return card;
  }

  /* ======================================================================
     2) order.html — prefill from URL + submit to Apps Script
     ====================================================================== */

  function initOrder() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    // Prefill #items and #total from ?item=...&price=...
    var params = new URLSearchParams(window.location.search);
    var itemField = document.getElementById("items");
    var totalField = document.getElementById("total");
    if (itemField && params.get("item") !== null) itemField.value = params.get("item");
    if (totalField && params.get("price") !== null) totalField.value = params.get("price");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (typeof form.reportValidity === "function" && !form.reportValidity()) return;

      var payload = {
        customerName: document.getElementById("customerName").value.trim(),
        contact: document.getElementById("contact").value.trim(),
        items: document.getElementById("items").value.trim(),
        total: document.getElementById("total").value.trim(),
        note: document.getElementById("note").value.trim(),
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .then(() => {
          window.location.href = "thankyou.html";
        })
        .catch((error) => {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ======================================================================
     3) admin.html — read published CSV and show newest first
     ====================================================================== */

  // Minimal RFC-4180 CSV parser: quoted fields, "" escapes, commas/newlines inside quotes.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }

    // last field/row without trailing newline
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    // drop completely empty lines
    return rows.filter(function (r) {
      return r.some(function (c) {
        return c.trim() !== "";
      });
    });
  }

  function initAdmin() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    function message(text) {
      tbody.textContent = "";
      var tr = document.createElement("tr");
      var td = el("td", "text-center", text);
      td.colSpan = 6;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    message("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        rows.shift(); // header row
        rows.reverse(); // newest (last appended) first

        if (!rows.length) {
          message("ยังไม่มีคำสั่งซื้อ");
          return;
        }

        tbody.textContent = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          // A..F = date, name, contact, items, total, note
          for (var c = 0; c < 6; c++) {
            tr.appendChild(el("td", "", r[c] !== undefined ? r[c] : ""));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        message("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ---------- boot ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    initProducts();
    initOrder();
    initAdmin();
  });
})();
