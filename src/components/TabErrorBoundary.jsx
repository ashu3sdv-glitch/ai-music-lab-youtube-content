import { Component } from "react";

export default class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(`Ошибка вкладки ${this.props.label}`, error);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card warning-box">
        <strong>Не удалось загрузить сохранённые данные вкладки «{this.props.label}»</strong>
        <div className="muted small">Остальные разделы и настройки не затронуты.</div>
        <button onClick={this.reset}>Восстановить эту вкладку</button>
      </div>
    );
  }
}
