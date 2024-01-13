import styles from './App.module.scss';
import Boxer from './components/Boxer';

function App() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.container}><Boxer controls /></div>
    </div>
  );
}

export default App;
