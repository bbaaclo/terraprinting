import { useRef, useState } from 'react';
import AppHeader from './AppHeader.jsx';
import { GradientIcon, LockIcon, SparkIcon, TextShapeIcon, UploadIcon } from './icons.jsx';

const STEPS = [
  { title: 'Upload', text: 'A customer mockup, screenshot or logo.' },
  { title: 'Trace', text: 'Each color area becomes a clean filled shape.' },
  { title: 'Download', text: 'An SVG you can place in Photoshop.' },
];

const TIPS = [
  { Icon: SparkIcon, title: 'Best results', text: 'Flat, high-resolution designs with clear edges.' },
  { Icon: GradientIcon, title: 'Gradients', text: 'Fades come out as bands of color.' },
  { Icon: TextShapeIcon, title: 'Names and numbers', text: 'Traced as shapes, not editable text.' },
];

export default function UploadScreen({ onFile, error, busy }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const files = [...(event.dataTransfer.files ?? [])];
    if (files.length) onFile(files.slice(0, 2));
  };

  return (
    <>
      <AppHeader>
        <p className="privacy-note">
          <LockIcon width={16} height={16} />
          <span>Runs in your browser. Images are not uploaded to any server.</span>
        </p>
      </AppHeader>

      <main className="upload-page">
        <section className="upload-hero">
          <div className="hero-copy">
            <h1>Turn a customer design into an SVG</h1>
            <p className="hero-lede">
              Drop in a jersey, uniform or logo image. You get a clean SVG you can place in Photoshop.
            </p>
            <ol className="step-list">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="step-number">{i + 1}</span>
                  <span>
                    <strong>{step.title}</strong>
                    <span className="step-text">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div
            className={`dropzone${dragging ? ' is-dragging' : ''}${busy ? ' is-busy' : ''}`}
            onClick={openPicker}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <span className="dropzone-icon"><UploadIcon width={28} height={28} /></span>
            <p className="dropzone-title">
              {busy ? 'Opening image…' : dragging ? 'Drop to trace it' : 'Drag an image here, or click to choose'}
            </p>
            <p className="dropzone-formats">PNG, JPG or WebP · one image, or two for front and back</p>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={(e) => { e.stopPropagation(); openPicker(); }}
              disabled={busy}
            >
              Choose image
            </button>
            {error && <p className="inline-error" role="alert">{error}</p>}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = '';
                if (files.length) onFile(files.slice(0, 2));
              }}
            />
          </div>
        </section>

        <p className="privacy-note privacy-inline">
          <LockIcon width={16} height={16} />
          <span>Runs in your browser. Images are not uploaded to any server.</span>
        </p>

        <ul className="tip-row">
          {TIPS.map(({ Icon, title, text }) => (
            <li key={title} className="tip">
              <span className="tip-icon"><Icon /></span>
              <span>
                <strong>{title}</strong>
                <span className="tip-text">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
