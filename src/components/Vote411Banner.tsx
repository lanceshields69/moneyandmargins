import bubble from '../assets/vote411/speech-bubble.svg'
import vote from '../assets/vote411/group.svg'
import fourOneOne from '../assets/vote411/411.svg'

const VOTE411_URL = 'https://www.vote411.org/'

// The whole banner is one link, so the text carries no nested links. Nothing is requested until a visitor clicks it.
export default function Vote411Banner() {
  return (
    <a className="vote411" href={VOTE411_URL} target="_blank" rel="noopener noreferrer">
      <span className="vote411-text">
        Election Day is <span className="vote411-date">Tuesday, November 3</span>. Find your ballot and polling place at Vote411.
      </span>
      <span className="vote411-logo" role="img" aria-label="Vote411 logo">
        <img className="v411-bubble" src={bubble} alt="" />
        <img className="v411-vote" src={vote} alt="" />
        <img className="v411-num" src={fourOneOne} alt="" />
        <span className="v411-sm" aria-hidden="true">SM</span>
      </span>
    </a>
  )
}
