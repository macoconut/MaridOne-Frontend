type InputProps = {
    label: string;
    type?: string;
    placeholder?: string;
  };
  
  export default function Input({
    label,
    type = 'text',
    placeholder,
  }: InputProps) {
    return (
      <div>
        <label>{label}</label>
        <input type={type} placeholder={placeholder} />
      </div>
    );
  }
  