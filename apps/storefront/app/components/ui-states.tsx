import Link from 'next/link'
import { useId } from 'react'

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}) {
  const titleId = useId()
  return (
    <section className="ui-state" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {actionHref && actionLabel ? <Link className="button" href={actionHref}>{actionLabel}</Link> : null}
    </section>
  )
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="inline-error" role="alert">
      <p>{message}</p>
      {onRetry ? <button type="button" onClick={onRetry}>Thử lại</button> : null}
    </div>
  )
}

export function LoadingSkeleton({ label = 'Đang tải nội dung' }: { label?: string }) {
  return <div className="loading-skeleton" role="status" aria-label={label} />
}
