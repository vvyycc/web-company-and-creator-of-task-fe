import { FormEvent, useState } from 'react';

const CONTACT_ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT || 'http://localhost:4000/contact';

type FormState = {
  name: string;
  email: string;
  projectType: 'Automatización' | 'Web3' | 'Web2' | 'Mixto';
  message: string;
  privacy: boolean;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

export default function ContactSection() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    projectType: 'Automatización',
    message: '',
    privacy: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState<string>('');

  const validate = (): FormErrors => {
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = 'El nombre es obligatorio.';
    if (!form.email.trim()) {
      newErrors.email = 'El email es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Introduce un email válido.';
    }
    if (!form.message.trim()) newErrors.message = 'Cuéntanos brevemente tu proyecto.';
    if (!form.privacy) newErrors.privacy = 'Debes aceptar la política de privacidad.';
    return newErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback('');
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    try {
      setStatus('submitting');
      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error('No se pudo enviar el formulario.');
      }

      setStatus('success');
      setFeedback('¡Gracias! Hemos recibido tu mensaje y responderemos en breve.');
      setForm({ name: '', email: '', projectType: 'Automatización', message: '', privacy: false });
      setErrors({});
    } catch (error) {
      console.error(error);
      setStatus('error');
      setFeedback('Ha ocurrido un error al enviar el mensaje. Por favor, inténtalo de nuevo.');
    }
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section id="contact" className="bg-slate-900 py-16 text-white lg:py-24">
      <div className="section-container grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-200">Contacto</p>
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Cuéntanos qué quieres construir y te proponemos el camino.
          </h2>
          <p className="text-lg text-slate-200">
            Resolvemos dudas, aterrizamos ideas y te acompañamos en cada etapa. Escríbenos y coordinamos una llamada
            exploratoria en menos de 24h.
          </p>
          <ul className="space-y-3 text-sm text-slate-200">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-400" />
              Soporte en español e inglés
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-400" />
              Equipos full-stack con experiencia en Web2 y Web3
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-400" />
              Roadmap claro y entregas iterativas
            </li>
          </ul>
        </div>

        <div className="card bg-white text-slate-900 shadow-xl shadow-primary-900/10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Nombre <span className="required">*</span>
              </label>
              <input
                id="name"
                name="name"
                className="input-field mt-2"
                placeholder="Tu nombre"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email <span className="required">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="input-field mt-2"
                placeholder="nombre@empresa.com"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="projectType">
                Tipo de proyecto
              </label>
              <select
                id="projectType"
                name="projectType"
                className="input-field mt-2"
                value={form.projectType}
                onChange={(e) => updateField('projectType', e.target.value as FormState['projectType'])}
              >
                <option>Automatización</option>
                <option>Web3</option>
                <option>Web2</option>
                <option>Mixto</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="message">
                Mensaje <span className="required">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                className="input-field mt-2 min-h-[120px]"
                placeholder="Describe tu idea, plazos y necesidades."
                value={form.message}
                onChange={(e) => updateField('message', e.target.value)}
                required
              />
              {errors.message && <p className="form-error">{errors.message}</p>}
            </div>

            <div className="flex items-start gap-3">
              <input
                id="privacy"
                name="privacy"
                type="checkbox"
                className="mt-1 h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                checked={form.privacy}
                onChange={(e) => updateField('privacy', e.target.checked)}
              />
              <div className="text-sm text-slate-600">
                <label htmlFor="privacy" className="font-medium text-slate-800">
                  Acepto la política de privacidad
                </label>
                <p className="text-slate-500">Tus datos se usarán solo para responder a tu mensaje.</p>
                {errors.privacy && <p className="form-error">{errors.privacy}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="btn-primary w-full justify-center"
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </div>

            {status === 'success' && feedback && (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{feedback}</p>
            )}
            {status === 'error' && feedback && (
              <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{feedback}</p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
