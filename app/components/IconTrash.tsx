"use client";

import React from "react";

type Props = {
  size?: number;
  className?: string;
  title?: string;
};

export default function IconTrash({ size = 18, className = "", title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={true}
      role="img"
    >
      {title && <title>{title}</title>}
      <path d="M3 6h18" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11v6" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 6V4h6v2" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
