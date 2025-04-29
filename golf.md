---
layout: default
title: Golf Scores
permalink: /golf/
---

# My Golf Scores

<div class="golf-stats-container">
  <div class="stats-summary">
    <div class="handicap-display">
      <h2>Current Handicap</h2>
      <div class="handicap-value" id="current-handicap">Loading...</div>
    </div>
    <div class="quick-stats">
      <div class="stat-box">
        <span class="stat-label">Rounds Played</span>
        <span class="stat-value" id="rounds-played">0</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Best Score</span>
        <span class="stat-value" id="best-score">--</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Avg. Score</span>
        <span class="stat-value" id="avg-score">--</span>
      </div>
    </div>
  </div>
  
  <div class="chart-container">
    <h3>Score Trends</h3>
    <canvas id="scoreChart"></canvas>
  </div>
  
  <div class="scores-table-container">
    <h3>Recent Rounds</h3>
    <table class="scores-table" id="scores-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Course</th>
          <th>Score</th>
          <th>Course Rating</th>
          <th>Slope Rating</th>
          <th>Differential</th>
        </tr>
      </thead>
      <tbody id="scores-body">
        <!-- Scores will be populated here -->
      </tbody>
    </table>
  </div>
</div>
