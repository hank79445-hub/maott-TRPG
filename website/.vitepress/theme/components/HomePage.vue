<script setup lang="ts">
import HeroSection from './HeroSection.vue'
import AudiencePaths from './AudiencePaths.vue'
import FeatureGrid from './FeatureGrid.vue'
import ProductTour from './ProductTour.vue'
import OpenSourceSection from './OpenSourceSection.vue'
import FaqSection from './FaqSection.vue'
</script>
<template>
  <div class="maott-home">
    <HeroSection /><AudiencePaths /><FeatureGrid /><ProductTour /><OpenSourceSection /><FaqSection />
  </div>
</template>
<style>
.maott-home {
  --section-gap: 88px;
  width: 100%;
  overflow: clip;
}
.home-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  margin-bottom: var(--section-gap);
}
.home-kicker {
  font: 600 13px/1.6 system-ui;
  letter-spacing: 0.14em;
  color: var(--gold);
  margin-bottom: 14px;
}
.home-title {
  font-size: clamp(28px, 3vw, 38px);
  line-height: 1.35;
  margin: 0 0 18px;
  letter-spacing: -0.02em;
}
.home-lead {
  max-width: 720px;
  font-size: 17px;
  line-height: 1.9;
  color: var(--ink);
  margin: 0 0 32px;
}
.home-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 11px 22px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border: 1px solid var(--accent);
  border-radius: 8px;
  text-decoration: none !important;
  gap: 8px;
}
.dark .home-action {
  color: var(--bg);
}
.home-action.secondary {
  background: var(--panel);
  color: var(--ink);
  border-color: var(--line);
}
.home-action:hover {
  filter: brightness(0.94);
}
.home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.home-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 4px;
  font-weight: 600;
}
.home-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 24px;
}
.home-card h3 {
  font-size: 22px;
  line-height: 1.4;
  margin: 0 0 12px;
}
.home-card p {
  font-size: 15px;
  line-height: 1.8;
  color: var(--ink);
}
.home-section :is(a, button) {
  scroll-margin-top: 88px;
}
@media (max-width: 767px) {
  .maott-home {
    --section-gap: 56px;
  }
  .home-section {
    padding: 0 18px;
  }
  .home-lead {
    font-size: 16px;
  }
  .home-card {
    padding: 20px;
  }
  .home-action {
    min-height: 46px;
  }
  .home-actions {
    gap: 10px;
  }
}
</style>
