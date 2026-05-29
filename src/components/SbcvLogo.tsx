type SbcvLogoProps = {
  animated?: boolean;
  className?: string;
};

const points = [
  [32, 8],
  [52, 20],
  [52, 44],
  [32, 56],
  [12, 44],
  [12, 20],
] as const;

export function SbcvLogo({ animated = false, className = "" }: SbcvLogoProps) {
  const classes = ["sbcv-logo", animated ? "sbcv-logo--animated" : "", className].filter(Boolean).join(" ");
  return (
    <svg className={classes} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <polygon
        className="sbcv-logo__hexagon"
        points="32,8 52,20 52,44 32,56 12,44 12,20"
        fill="#0d1116"
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <g className="sbcv-logo__links">
        {points.map(([x1, y1], index) => {
          const [x2, y2] = points[(index + 1) % points.length]!;
          return (
            <line
              key={`${x1}-${y1}`}
              className={`sbcv-logo__link sbcv-logo__link--${index + 1}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              pathLength="1"
            />
          );
        })}
      </g>
      <g className="sbcv-logo__dots">
        {points.map(([cx, cy], index) => (
          <circle
            key={`${cx}-${cy}`}
            className={`sbcv-logo__dot sbcv-logo__dot--${index + 1}`}
            cx={cx}
            cy={cy}
            r="6.6"
          />
        ))}
      </g>
    </svg>
  );
}
