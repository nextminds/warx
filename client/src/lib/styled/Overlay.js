import styled from 'styled-components';
import styles from './styles';

export default styled.div`
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: rgba(50, 50, 50, 0.75);
    z-index: ${styles.overlayIndex};
`;