 const form = document.querySelector('#activationForm');
const progressBar = document.querySelector('#progressBar');
const progressText = document.querySelector('#progressText');
const fileInput = document.querySelector('#firma');
const fileLabel = document.querySelector('#fileLabel');
const fileHint = document.querySelector('#fileHint');
const signaturePreview = document.querySelector('#signaturePreview');
const signatureNote = document.querySelector('#signatureNote');
const successMessage = document.querySelector('#successMessage');
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbznRivkkBmNPOzbilhm_3n29E0BArd33aD81yE-WA85ETetnVh2WGMxXRRtu7gq11j5/exec';

successMessage.hidden = true;
successMessage.style.display = 'none';

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

function clearErrors() {
  form.querySelectorAll('.invalid').forEach((item) => item.classList.remove('invalid'));
  form.querySelectorAll('.error-message').forEach((item) => { item.textContent = ''; });
}

function validateForm() {
  clearErrors();
  let firstInvalid = null;
  const checkedGroups = new Set();

  [...form.querySelectorAll('[required]')].forEach((field) => {
    if (field.type === 'radio') {
      if (checkedGroups.has(field.name)) return;
      checkedGroups.add(field.name);
    }
    const valueMissing = field.type === 'radio'
      ? !form.querySelector(`[name="${field.name}"]:checked`)
      : field.type === 'checkbox' ? !field.checked : !field.value.trim();
    if (valueMissing && !firstInvalid) firstInvalid = field;
    if (valueMissing) showError(field, field.type === 'checkbox' ? 'Debes aceptar estas condiciones.' : 'Este campo es obligatorio.');
  });

  const email = form.elements.correo;
  if (email.value && !email.validity.valid) {
    showError(email, 'Ingresa un correo electrónico válido.');
    firstInvalid = firstInvalid || email;
  }
  return firstInvalid;
}

form.addEventListener('input', updateProgress);
form.addEventListener('change', () => {
  updateSignatureRequirement();
  updateProgress();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file && file.size > 10 * 1024 * 1024) {
    fileLabel.textContent = 'El archivo supera los 10 MB';
    fileHint.textContent = 'Selecciona una imagen de máximo 10 MB.';
    signaturePreview.hidden = true;
    signaturePreview.removeAttribute('src');
    fileInput.value = '';
    return;
  }
  fileLabel.textContent = file ? file.name : 'Subir imagen de la firma';
  fileHint.textContent = file ? 'Imagen seleccionada correctamente.' : 'PNG, JPG o WEBP · Máximo 10 MB';
  if (file) {
    signaturePreview.src = URL.createObjectURL(file);
    signaturePreview.hidden = false;
  } else {
    signaturePreview.hidden = true;
    signaturePreview.removeAttribute('src');
  }
  updateSignatureRequirement();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const isAssistance = form.querySelector('input[name="perfil"]:checked')?.value === 'Asistencial';
  if (isAssistance && !fileInput.files[0]) {
    alert('Por favor adjunte la firma.');
    fileInput.focus();
    return;
  }
  const firstInvalid = validateForm();
  if (firstInvalid) { firstInvalid.focus(); return; }
  const submitButton = form.querySelector('.submit-button');
  submitButton.disabled = true;
  submitButton.innerHTML = 'Enviando solicitud...';

  const values = Object.fromEntries(new FormData(form).entries());
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  values.requestId = requestId;
  values.area = form.querySelector('input[name="area"]:checked')?.value || '';
  values.perfil = form.querySelector('input[name="perfil"]:checked')?.value || '';
  values.vinculacion = form.querySelector('input[name="vinculacion"]:checked')?.value || '';
  values.aceptacion = form.elements.aceptacion.checked ? 'Sí' : 'No';
  delete values.firma;

  const selectedFile = fileInput.files[0];
  const sendRequest = (payload) => {
    if (!GOOGLE_APPS_SCRIPT_URL) throw new Error('Falta la URL del servicio.');
    return fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(payload)
    });
  };

  const waitForConfirmation = (id, attempts = 30) => new Promise((resolve, reject) => {
    const callbackName = `confirm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const retry = () => {
      if (attempts <= 1) return reject(new Error('El registro no fue confirmado en la hoja después de 30 segundos.'));
      setTimeout(() => waitForConfirmation(id, attempts - 1).then(resolve, reject), 1000);
    };
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    window[callbackName] = (result) => {
      cleanup();
      if (result.ok) return resolve();
      retry();
    };
    script.onerror = () => {
      cleanup();
      retry();
    };
    script.src = `${GOOGLE_APPS_SCRIPT_URL}?action=check&id=${encodeURIComponent(id)}&callback=${callbackName}&cacheBust=${Date.now()}`;
    document.body.appendChild(script);
  });

  const fileReader = selectedFile ? new FileReader() : null;
  const fileReady = fileReader ? new Promise((resolve) => {
    fileReader.onload = () => resolve({ name: selectedFile.name, mimeType: selectedFile.type, base64: fileReader.result.split(',')[1] });
    fileReader.readAsDataURL(selectedFile);
  }) : Promise.resolve(null);

  fileReady.then((signature) => sendRequest({ values, signature }))
    .then(() => waitForConfirmation(requestId))
    .then(() => {
      form.hidden = true;
      document.querySelector('#submittedId').textContent = `Solicitud registrada para la cédula ${values.cedula}.`;
      successMessage.hidden = false;
      successMessage.style.display = 'flex';
      successMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    })
    .catch((error) => {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Reintentar envío <span aria-hidden="true">→</span>';
      alert(`No fue posible confirmar la solicitud. ${error.message} Verifica la conexión y vuelve a intentarlo.`);
    });
});

document.querySelector('#newRequest').addEventListener('click', () => {
  form.reset();
  form.hidden = false;
  successMessage.hidden = true;
  successMessage.style.display = 'none';
  fileLabel.textContent = 'Subir imagen de la firma';
  fileHint.textContent = 'PNG, JPG o WEBP · Máximo 10 MB';
  signaturePreview.hidden = true;
  signaturePreview.removeAttribute('src');
  updateSignatureRequirement();
  updateProgress();
});

updateSignatureRequirement();
updateProgress();
