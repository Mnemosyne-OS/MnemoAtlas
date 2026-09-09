import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { cn } from '@/lib/utils';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max];

  return (
    <SliderPrimitive.Root
      className={cn('data-horizontal:w-full data-vertical:h-full', className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      // NOT `thumbAlignment="edge"`, and that is the whole fix for a thumb that
      // never appeared until the first click.
      //
      // `edge` keeps the thumb fully inside the track at 0% and 100%, and it pays
      // for that with a MEASUREMENT: base-ui hides the thumb (`visibility:hidden`,
      // inline) until it has divided the thumb's offset by the control's width. In
      // an iframe that mounts before it has a width — which is exactly how a
      // cartridge is born inside the shell — that division is not finite, the
      // position stays undefined, and the ResizeObserver meant to catch up never
      // does. Measured: the slider laid out at 325px with the thumb still hidden,
      // three seconds after the iframe was given its size. Clicking the track
      // changes the value, which re-runs the measurement, which is why the thumb
      // "comes back" and looks like it was there all along.
      //
      // The default alignment computes the position from the value alone. Nothing
      // to measure, nothing to miss. The thumb overhangs the track by half its
      // width at the two ends, which is what an ordinary slider does.
      {...props}
    >
      <SliderPrimitive.Control className="data-vertical:min-h-40 relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-muted rounded-full data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1 relative grow overflow-hidden select-none"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="border-ring ring-ring/50 relative size-3 rounded-full border bg-white transition-[color,box-shadow] after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 block shrink-0 select-none disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
