import React from "react";
import { HStack } from "@chakra-ui/react";

const SegmentedControl = ({
  options,
  value,
  onChange,
  disabled = false,
  width = "auto"
}) => {
  return (
    <HStack
      spacing={0}
      width={width}
      className="segmented-control"
      role="radiogroup"
    >
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled || option.disabled}
            onClick={() => !disabled && !option.disabled && onChange(option.value)}
            className={`segmented-control-option ${isSelected ? 'selected' : ''} ${isFirst ? 'first' : ''} ${isLast ? 'last' : ''}`}
            style={{
              flex: 1,
              opacity: (disabled || option.disabled) ? 0.5 : 1,
              cursor: (disabled || option.disabled) ? 'not-allowed' : 'pointer'
            }}
          >
            {option.label}
          </button>
        );
      })}
    </HStack>
  );
};

export default SegmentedControl;
