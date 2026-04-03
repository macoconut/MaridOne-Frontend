import type { ReactNode } from 'react';
import './PageHeader.css';

type PageHeaderProps = {
  title: string;
  description: string;
  meta?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  meta,
}: PageHeaderProps) {
  return (
    <div className="pageHeader">
      <h1 className="pageHeader__title">{title}</h1>
      <p className="pageHeader__description">{description}</p>
      {meta ? <div className="pageHeader__meta">{meta}</div> : null}
    </div>
  );
}
