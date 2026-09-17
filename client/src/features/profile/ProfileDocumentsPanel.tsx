interface Props {
  photoUrl?: string | null | undefined;
  employeeName: string;
}

export function ProfileDocumentsPanel({ photoUrl, employeeName }: Props): React.ReactElement {
  return (
    <div className="ph-docs">
      <div className="ph-docs__header">
        <p className="eyebrow">Documents & Files</p>
      </div>

      <div className="ph-docs__grid">
        {/* Employee photo card */}
        <div className="ph-doc-card">
          <div className="ph-doc-card__preview">
            {photoUrl ? (
              <img src={photoUrl} alt={employeeName} className="ph-doc-card__img" />
            ) : (
              <div className="ph-doc-card__placeholder">
                <span className="ph-doc-card__placeholder-icon" aria-hidden="true">👤</span>
              </div>
            )}
          </div>
          <div className="ph-doc-card__info">
            <p className="ph-doc-card__title">Profile Photo</p>
            <p className="ph-doc-card__sub">{photoUrl ? "Uploaded" : "Not uploaded"}</p>
          </div>
        </div>

        {/* Backup letter placeholder */}
        <div className="ph-doc-card ph-doc-card--locked">
          <div className="ph-doc-card__preview ph-doc-card__preview--placeholder">
            <span className="ph-doc-card__placeholder-icon" aria-hidden="true">📄</span>
          </div>
          <div className="ph-doc-card__info">
            <p className="ph-doc-card__title">Backup Letter</p>
            <p className="ph-doc-card__sub ph-doc-card__sub--muted">Coming soon</p>
          </div>
        </div>

        {/* ID card placeholder */}
        <div className="ph-doc-card ph-doc-card--locked">
          <div className="ph-doc-card__preview ph-doc-card__preview--placeholder">
            <span className="ph-doc-card__placeholder-icon" aria-hidden="true">🪪</span>
          </div>
          <div className="ph-doc-card__info">
            <p className="ph-doc-card__title">ID Card</p>
            <p className="ph-doc-card__sub ph-doc-card__sub--muted">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
