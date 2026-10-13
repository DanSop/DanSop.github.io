---
layout: default
title: Golf Scores
permalink: /golf/
golf: true
---

# Golf

<div class="golf-summary">
  <div class="handicap"><span class="value" id="current-handicap">--</span><span class="label">Handicap Index</span></div>
  <div><span class="value" id="rounds-played">--</span><span class="label">Rounds</span></div>
  <div><span class="value" id="best-score">--</span><span class="label">Best</span></div>
  <div><span class="value" id="avg-score">--</span><span class="label">Average</span></div>
</div>

<div class="chart-container">
  <canvas id="scoreChart" aria-label="Score trend"></canvas>
</div>

<div class="table-wrap">
  <table class="scores-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Course</th>
        <th>Score</th>
        <th>Rating</th>
        <th>Slope</th>
        <th>Diff.</th>
      </tr>
    </thead>
    <tbody id="scores-body"></tbody>
  </table>
</div>

<script id="golf-data" type="application/json">{{ site.data.golf | jsonify }}</script>
