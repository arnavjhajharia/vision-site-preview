/* Vision waitlist interview: pure logic shared by the chat UI (index.html) and the tests (tests/).
   Branch picking mirrors personal-agent src/features/waitlist/interview.js (variantFor / resolveQuestion):
   the first variant whose "when" matches EARLIER answers rewords a question; option ids never change. */
(function (root) {
  'use strict';
  function list(v) { return v == null ? [] : [].concat(v); }

  function fill(tpl, vars) {
    return String(tpl == null ? '' : tpl).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? String(vars[k]) : m; });
  }

  function variantFor(q, answers) {
    var vs = q.variants || [];
    for (var i = 0; i < vs.length; i++) {
      var w = vs[i].when || {}, keys = Object.keys(w), ok = keys.length > 0;
      for (var j = 0; ok && j < keys.length; j++) {
        var picked = list(answers && answers[keys[j]]);
        ok = picked.some(function (a) { return w[keys[j]].indexOf(a) >= 0; });
      }
      if (ok) return vs[i];
    }
    return null;
  }

  // The question as Vision asks it, given what was answered so far.
  function resolve(q, answers) {
    var v = variantFor(q, answers) || {}, react = {}, k;
    for (k in q.react || {}) react[k] = q.react[k];
    for (k in v.react || {}) react[k] = v.react[k];
    return {
      id: q.id, type: q.type, variant: v.id || null,
      text: v.text || q.text, hint: v.hint != null ? v.hint : (q.hint || ''),
      note: !!q.note, react: react, reactMany: v.reactMany || q.reactMany || '', reactNote: q.reactNote || '',
      options: (q.options || []).map(function (o) {
        return { id: o.id, label: (v.labels && v.labels[o.id]) || o.label, text: !!o.text, match: o.match || [], range: o.range || null };
      })
    };
  }

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Keyword hit at a word start; short keywords ("no", "yes") must be whole words. Returns the keyword length (0 = miss).
  function hit(text, kw) {
    kw = String(kw).toLowerCase();
    var re = new RegExp('(^|[^a-z0-9])' + esc(kw) + (kw.length <= 3 ? '($|[^a-z0-9])' : ''), 'i');
    return re.test(text) ? kw.length : 0;
  }

  // Typed text -> { ids: [optionIds], note } . ids is empty when nothing matched (UI then asks to tap a chip).
  function matchText(rq, raw) {
    var text = String(raw || '').toLowerCase().trim(), opts = rq.options;
    if (!text) return { ids: [], note: '' };
    var m = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
    if (m && rq.type !== 'multi') {
      var n = parseFloat(m[0]);
      for (var i = 0; i < opts.length; i++) {
        var r = opts[i].range;
        if (r && n >= r[0] && n <= r[1]) return { ids: [opts[i].id], note: String(raw).trim() };
      }
    }
    var scored = opts.map(function (o) {
      var best = 0;
      (o.match || []).forEach(function (kw) { best = Math.max(best, hit(text, kw)); });
      if (!best && hit(text, o.label) && o.label.length > 3) best = o.label.length;
      return { id: o.id, s: best };
    }).filter(function (x) { return x.s > 0; });
    var note = String(raw).trim();
    if (rq.type === 'multi') {
      if (scored.length) return { ids: scored.map(function (x) { return x.id; }), note: note };
    } else if (scored.length) {
      scored.sort(function (a, b) { return b.s - a.s; });
      return { ids: [scored[0].id], note: note };
    }
    var other = opts.filter(function (o) { return o.text; })[0];
    return { ids: other ? [other.id] : [], note: note };
  }

  // Vision's one-line reaction to an answer. rand() is injectable for tests.
  function reaction(rq, value, note, rand) {
    rand = rand || Math.random;
    var ids = list(value), pickOne = function (x) { x = list(x); return x.length ? x[Math.floor(rand() * x.length) % x.length] : ''; };
    var labels = ids.map(function (id) { var o = rq.options.filter(function (x) { return x.id === id; })[0]; return o ? o.label : id; });
    if (rq.type === 'multi' && ids.length > 1 && rq.reactMany) return fill(pickOne(rq.reactMany), { labels: joinAnd(labels), n: ids.length });
    var other = rq.options.filter(function (o) { return o.text && ids.indexOf(o.id) >= 0; })[0];
    if (other && note && rq.reactNote) return fill(pickOne(rq.reactNote), { note: note, label: labels[0] });
    return fill(pickOne(rq.react[ids[0]]), { label: labels[0] || '', note: note || '' });
  }

  function joinAnd(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  // Answers for questions that no longer exist are dropped; returns index of the first unanswered question.
  function firstOpen(questions, answers) {
    for (var i = 0; i < questions.length; i++) if (!list(answers[questions[i].id]).length) return i;
    return questions.length;
  }

  var api = { fill: fill, variantFor: variantFor, resolve: resolve, matchText: matchText, reaction: reaction, firstOpen: firstOpen, joinAnd: joinAnd };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VisionInterview = api;
})(typeof window !== 'undefined' ? window : this);
