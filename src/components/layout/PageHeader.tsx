import type { ReactNode } from 'react';
import './PageHeader.css';

type PageHeaderProps = {
  title: string;
  description?: string;
  titleMeta?: ReactNode;
  meta?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  titleMeta,
  meta,
}: PageHeaderProps) {
  return (
    <div className="pageHeader">
      <div className="pageHeader__titleRow">
        <h1 className="pageHeader__title">{title}</h1>
        {titleMeta ? <div className="pageHeader__titleMeta">{titleMeta}</div> : null}
      </div>
      {description ? <p className="pageHeader__description">{description}</p> : null}
      {meta ? <div className="pageHeader__meta">{meta}</div> : null}
    </div>
  );
}
