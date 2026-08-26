import { Link } from "react-router-dom";

import { BackIcon } from "../components/icons.js";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  back?: { to: string; label: string };
  actions?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  back,
  actions,
}: PageHeaderProps): React.ReactElement {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {back ? (
          <Link className="backlink" to={back.to}>
            <BackIcon className="backlink__icon" />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="page-header__title">{title}</h1>
        {description ? (
          <p className="page-header__description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
