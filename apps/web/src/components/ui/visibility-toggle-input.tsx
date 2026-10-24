"use client";

import { type InputHTMLAttributes, useState } from "react";

type VisibilityToggleInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
	visibilityLabel: string;
};

export function VisibilityToggleInput({ visibilityLabel, className = "", id, ...inputProps }: VisibilityToggleInputProps) {
	const [visible, setVisible] = useState(false);
	const actionLabel = `${visible ? "Hide" : "Show"} ${visibilityLabel}`;

	return (
		<div className="relative">
			<input {...inputProps} id={id} type={visible ? "text" : "password"} className={`${className} pr-12`} />
			<button
				type="button"
				aria-label={actionLabel}
				aria-pressed={visible}
				aria-controls={id}
				title={actionLabel}
				onClick={() => setVisible((current) => !current)}
				className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-[#f3f6f1] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 focus-visible:ring-offset-1"
			>
				{visible ? (
					<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" className="size-5">
						<path
							d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.9 10.9 0 0112 5c5.2 0 8.6 4.6 9.5 7-.4 1-1.2 2.2-2.3 3.4M6.2 6.2C3.9 7.7 2.8 10 2.5 12c.4 1 1.2 2.2 2.3 3.4 1.8 1.9 4.3 3.6 7.2 3.6 1.2 0 2.3-.3 3.4-.8"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				) : (
					<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" className="size-5">
						<path
							d="M2.5 12S5.9 5 12 5s9.5 7 9.5 7-3.4 7-9.5 7-9.5-7-9.5-7Z"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinejoin="round"
						/>
						<circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
					</svg>
				)}
			</button>
		</div>
	);
}
