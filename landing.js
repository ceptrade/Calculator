const intro = document.getElementById('landing-screen');
const calculator = document.getElementById('app-screen');
function startPropertyEstimate() {
  intro.hidden = true;
  calculator.classList.add('active');
  switchTab('calc');
  window.scrollTo(0, 0);
  document.getElementById('property-heading').focus({preventScroll:true});
}
document.querySelectorAll('[data-start-estimate]').forEach(button => button.addEventListener('click', startPropertyEstimate));
document.getElementById('back-to-intro').addEventListener('click', () => {
  calculator.classList.remove('active');
  intro.hidden = false;
  window.scrollTo(0, 0);
  document.querySelector('[data-start-estimate]').focus({preventScroll:true});
});
// A saved calculator shortcut can still start directly on property inputs.
if (location.hash === '#estimate') startPropertyEstimate();
