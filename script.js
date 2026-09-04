const form = document.querySelector('#activationForm');
const progressBar = document.querySelector('#progressBar');
const progressText = document.querySelector('#progressText');
const fileInput = document.querySelector('#firma');
const fileLabel = document.querySelector('#fileLabel');
const fileHint = document.querySelector('#fileHint');
const signaturePreview = document.querySelector('#signaturePreview');
const signatureNote = document.querySelector('#signatureNote');
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbznRivkkBmNPOzbilhm_3n29E0BArd33aD81yE-WA85ETetnVh2WGMxXRRtu7gq11j5/exec';


function updateProgress() {
  const requiredFields = [...form.querySelectorAll('[required]')];
  const completed = requiredFields.filter((field) => field.type === 'radio' ? form.querySelector(`[name="${field.name}"]:checked`) === field : field.type === 'checkbox' ? field.checked : field.value.trim()).length;
  const percent = Math.round((completed / requiredFields.length) * 100);
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
}


function showError(field, message) {
  const container = field.closest('.field, .choice-group, .consent, .upload-zone');
  if (!container) return;
  container.classList.add('invalid');
  const error = container.querySelector('.error-message');
  if (error) error.textContent = message;
}


function updateSignatureRequirement() {
  const isAssistance = form.querySelector('input[name="perfil"]:checked')?.value === 'Asistencial';
  fileInput.required = isAssistance;
  signatureNote.textContent = isAssistance
    ? 'Como seleccionaste el perfil Asistencial, debes adjuntar una imagen clara de tu firma.'
    : 'Este paso es opcional. Adjunta una imagen clara de tu firma si aplica a tu solicitud.';
  fileLabel.textContent = isAssistance && !fileInput.files[0]
    ? 'Subir imagen de la firma *'
    : fileInput.files[0]?.name || 'Subir imagen de la firma';
}
