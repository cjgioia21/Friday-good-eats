(function () {
  "use strict";

  var DATA = window.FGE_DATA || { updated: "", restaurants: [] };
  var ALL = DATA.restaurants;
  var CITIES = ["Kitchener", "Waterloo", "Cambridge"];

  var state = { q: "", city: "", group: "", price: "", diet: "", sort: "name" };

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    stats: $("stats"), q: $("q"), city: $("city"), group: $("group"), price: $("price"),
    diet: $("diet"), sort: $("sort"), pick: $("pick"), reset: $("reset"), chips: $("chips"),
    results: $("results"), count: $("count"), empty: $("empty"), emptyReset: $("empty-reset"),
    updated: $("updated")
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fold(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function cities(r) {
    var seen = [];
    r.locations.forEach(function (l) { if (seen.indexOf(l.city) < 0) seen.push(l.city); });
    return seen;
  }

  ALL.forEach(function (r) {
    r._cities = cities(r);
    r._hay = fold([
      r.name, r.group, r.cuisine, r.category, r.description, (r.dishes || []).join(" "),
      r.locations.map(function (l) { return l.address + " " + l.area + " " + l.city; }).join(" ")
    ].join(" "));
  });

  function matches(r, skip) {
    if (state.city && r._cities.indexOf(state.city) < 0) return false;
    if (skip !== "group" && state.group && r.group !== state.group) return false;
    if (state.price && r.tier !== state.price) return false;
    if (state.diet && (r.dietary || []).indexOf(state.diet) < 0) return false;
    if (state.q) {
      var terms = fold(state.q).split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) if (r._hay.indexOf(terms[i]) < 0) return false;
    }
    return true;
  }

  var sorters = {
    name: function (a, b) { return a.name.localeCompare(b.name); },
    price: function (a, b) { return a.cost - b.cost || a.name.localeCompare(b.name); },
    cuisine: function (a, b) { return a.group.localeCompare(b.group) || a.name.localeCompare(b.name); },
    city: function (a, b) { return a._cities[0].localeCompare(b._cities[0]) || a.name.localeCompare(b.name); }
  };

  function groupCounts(list) {
    var counts = {};
    list.forEach(function (r) { counts[r.group] = (counts[r.group] || 0) + 1; });
    return counts;
  }

  function renderStats() {
    var html = '<div class="stat"><dt>Restaurants</dt><dd>' + ALL.length + "</dd></div>";
    CITIES.forEach(function (c) {
      var n = ALL.filter(function (r) { return r._cities.indexOf(c) >= 0; }).length;
      html += '<div class="stat"><dt><span class="dot dot-' + c + '"></span>' + c + "</dt><dd>" + n + "</dd></div>";
    });
    html += '<div class="stat"><dt>Cuisines</dt><dd>' + Object.keys(groupCounts(ALL)).length + "</dd></div>";
    els.stats.innerHTML = html;
    if (DATA.updated) els.updated.textContent = DATA.updated;
  }

  function renderCityControl() {
    var opts = [""].concat(CITIES);
    els.city.innerHTML = opts.map(function (c) {
      var dot = c ? '<span class="dot dot-' + c + '"></span>' : "";
      return '<button type="button" role="radio" data-city="' + c + '" aria-checked="' + (state.city === c) + '">' +
        dot + (c || "All") + "</button>";
    }).join("");
  }

  function renderGroupOptions(pool) {
    var counts = groupCounts(pool);
    var names = Object.keys(groupCounts(ALL)).sort();
    els.group.innerHTML = '<option value="">All cuisines</option>' + names.map(function (g) {
      return '<option value="' + esc(g) + '"' + (state.group === g ? " selected" : "") + ">" +
        esc(g) + " (" + (counts[g] || 0) + ")</option>";
    }).join("");
  }

  function renderChips(pool) {
    var counts = groupCounts(pool);
    var names = Object.keys(groupCounts(ALL)).sort(function (a, b) {
      return (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b);
    });
    els.chips.innerHTML = names.map(function (g) {
      var n = counts[g] || 0;
      return '<button type="button" class="chip" data-group="' + esc(g) + '" aria-pressed="' + (state.group === g) + '"' +
        (n || state.group === g ? "" : " disabled") + ">" + esc(g) + " <span>" + n + "</span></button>";
    }).join("");
  }

  function mapsUrl(r, l) {
    return "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(r.name + ", " + (l.address ? l.address + ", " : "") + l.city + ", ON");
  }

  function card(r) {
    var locs = r.locations.map(function (l) {
      return '<li><span class="dot dot-' + esc(l.city) + '" title="' + esc(l.city) + '"></span><span>' +
        '<span class="addr">' + esc(l.address || "Address not listed") + "</span>" +
        ' <span class="area">&middot; ' + esc(l.area ? l.area + ", " + l.city : l.city) + "</span></span></li>";
    }).join("");
    var dishes = (r.dishes || []).length
      ? '<ul class="dishes" aria-label="Known for">' + r.dishes.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>"
      : "";
    var tags = [r.category].concat(r.dietary || []).filter(Boolean);
    var links = '<a href="' + mapsUrl(r, r.locations[0]) + '" target="_blank" rel="noopener">Map</a>';
    if (r.website) links += '<a href="' + esc(r.website) + '" target="_blank" rel="noopener">Website</a>';
    return '<article class="card" id="r-' + esc(r.id) + '">' +
      '<div class="card-top"><span class="group">' + esc(r.group) + "</span>" +
      '<span class="price" title="Typical cost per person"><b>' + esc(r.tier) + "</b> &middot; ~$" + r.cost + "/person</span></div>" +
      "<h3>" + esc(r.name) + "</h3>" +
      '<p class="cuisine">' + esc(r.cuisine) + "</p>" +
      (r.description ? '<p class="desc">' + esc(r.description) + "</p>" : "") +
      dishes +
      '<ul class="locs">' + locs + "</ul>" +
      '<div class="card-foot"><div class="tags">' + tags.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") +
      '</div><div class="links">' + links + "</div></div>" +
      "</article>";
  }

  var current = [];

  function render() {
    var pool = ALL.filter(function (r) { return matches(r, "group"); });
    current = pool.filter(function (r) { return matches(r); }).sort(sorters[state.sort]);
    renderGroupOptions(pool);
    renderChips(pool);
    els.results.innerHTML = current.map(card).join("");
    els.empty.hidden = current.length > 0;
    els.pick.disabled = current.length === 0;
    els.count.textContent = current.length === ALL.length
      ? "Showing all " + ALL.length
      : "Showing " + current.length + " of " + ALL.length;
  }

  function resetFilters() {
    state = { q: "", city: "", group: "", price: "", diet: "", sort: state.sort };
    els.q.value = "";
    els.price.value = "";
    els.diet.value = "";
    renderCityControl();
    render();
  }

  els.q.addEventListener("input", function () { state.q = els.q.value.trim(); render(); });
  els.group.addEventListener("change", function () { state.group = els.group.value; render(); });
  els.price.addEventListener("change", function () { state.price = els.price.value; render(); });
  els.diet.addEventListener("change", function () { state.diet = els.diet.value; render(); });
  els.sort.addEventListener("change", function () { state.sort = els.sort.value; render(); });
  els.city.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-city]");
    if (!b) return;
    state.city = b.getAttribute("data-city");
    renderCityControl();
    render();
  });
  els.chips.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-group]");
    if (!b) return;
    var g = b.getAttribute("data-group");
    state.group = state.group === g ? "" : g;
    render();
  });
  els.reset.addEventListener("click", resetFilters);
  els.emptyReset.addEventListener("click", resetFilters);
  els.pick.addEventListener("click", function () {
    if (!current.length) return;
    var prev = els.results.querySelector(".is-picked");
    if (prev) prev.classList.remove("is-picked");
    var r = current[Math.floor(Math.random() * current.length)];
    var el = document.getElementById("r-" + r.id);
    if (!el) return;
    el.classList.add("is-picked");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  });

  renderStats();
  renderCityControl();
  render();
})();
