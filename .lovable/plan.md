

# Fix: Console Warnings for Ref on Function Components

## Problem
The console shows two React warnings on the Technicians page:
- "Function components cannot be given refs" for `Dialog` (check render method of `Technicians`)
- "Function components cannot be given refs" for `DialogPortal` (check render method of `DialogContent`)

These occur because `DialogPrimitive.Root` and `DialogPrimitive.Portal` from Radix UI are plain function components that don't support `forwardRef`, but React is attempting to pass refs to them.

## Solution
Wrap `Dialog` and `DialogPortal` in `React.forwardRef` inside `src/components/ui/dialog.tsx` so they can safely accept (and ignore) refs without triggering warnings.

## Technical Details

**File: `src/components/ui/dialog.tsx`**

Replace the plain assignments:
```typescript
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
```

With forwardRef wrappers:
```typescript
const Dialog = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
>((props, _ref) => <DialogPrimitive.Root {...props} />);
Dialog.displayName = "Dialog";

const DialogPortal = React.forwardRef<
  any,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>
>((props, _ref) => <DialogPrimitive.Portal {...props} />);
DialogPortal.displayName = "DialogPortal";
```

This eliminates both console warnings without changing any behavior.

