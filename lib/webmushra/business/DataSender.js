/* webMUSHRA DataSender, patched for static hosting (GitHub Pages / HF static).
   remoteService options:
     "download"            -> build mushra CSV (same columns as service/write.php) and download it in the browser
     https://...           -> fire-and-forget POST (e.g. Google Apps Script), opaque response
     service/write.php     -> original synchronous XHR
   The session JSON is always kept in localStorage ("webmushra_last_session") as a backup. */
function DataSender(config) {
  this.target = config.remoteService;
}

DataSender.prototype.toCsv = function(s) {
  var names = (s.participant && s.participant.name) || [];
  var resp = (s.participant && s.participant.response) || [];
  var rows = [["session_test_id"].concat(names, ["session_uuid", "trial_id", "rating_stimulus", "rating_score", "rating_time", "rating_comment"])];
  (s.trials || []).forEach(function(t) {
    if (t.type !== "mushra") return;
    (t.responses || []).forEach(function(r) {
      rows.push([s.testId].concat(resp, [s.uuid, t.id, r.stimulus, r.score, r.time, r.comment || ""]));
    });
  });
  return rows.map(function(row) {
    return row.map(function(v) { v = (v === null || v === undefined) ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",");
  }).join("\n") + "\n";
};

DataSender.prototype.send = function(_session) {
  var sessionJSON = JSON.stringify(_session);
  var target = this.target;
  try { localStorage.setItem("webmushra_last_session", sessionJSON); } catch (e) {}

  if (target === "download") {
    try {
      var csv = this.toCsv(_session);
      var blob = new Blob([csv], {type: "text/csv"});
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mushra_" + (_session.uuid || Date.now()) + ".csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return false;
    } catch (e) { console.log("download failed", e); return true; }
  }

  if (/^https?:\/\//i.test(target)) {
    try {
      fetch(target, {method: "POST", mode: "no-cors", keepalive: true,
                     headers: {"Content-Type": "application/x-www-form-urlencoded"},
                     body: "sessionJSON=" + encodeURIComponent(sessionJSON)});
    } catch (e) { console.log("results POST failed", e); return true; }
    return false;
  }

  var httpReq = new XMLHttpRequest();
  try {
    httpReq.open("POST", target, false);
    httpReq.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    httpReq.send("sessionJSON=" + encodeURIComponent(sessionJSON));
  } catch (e) { console.log(httpReq.responseText); return true; }
  if (httpReq.responseText != "" || httpReq.status != 200) { console.log(httpReq.responseText); return true; }
  return false;
};
