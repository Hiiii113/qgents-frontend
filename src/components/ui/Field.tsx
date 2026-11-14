import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/** 原生控件保持简单：Form.Item 直接注入 value/onChange，外观由设计系统统一。 */
export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextField(props, ref) {
    return <input ref={ref} {...props} />
  },
)

export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextAreaField(props, ref) {
  return <textarea ref={ref} {...props} />
})

export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ className = '', ...props }, ref) {
    return <select ref={ref} className={`select ${className}`.trim()} {...props} />
  },
)
