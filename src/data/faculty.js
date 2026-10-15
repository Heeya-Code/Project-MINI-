// Mock faculty pools (6 per department). Names are invented for the demo.
export const facultyPool = {
  comp: ['Dr. Rupali Sarode', 'Prof. A. Deshpande', 'Prof. S. Patil', 'Prof. N. Gupta', 'Prof. H. Sawant', 'Prof. L. D\u2019Souza'],
  it: ['Prof. S. Pillai', 'Prof. K. Iyer', 'Prof. J. Fernandes', 'Prof. B. Mehta', 'Prof. U. Naik'],
  aids: ['Prof. N. Rao', 'Prof. T. Bhatt', 'Prof. P. Chawla', 'Prof. G. Menon', 'Prof. Y. Kapoor', 'Prof. D. Sinha'],
  extc: ['Prof. K. Nair', 'Prof. D. Menon', 'Prof. R. Bose', 'Prof. F. Ansari', 'Prof. V. Rane', 'Prof. C. Dutta'],
  chem: ['Prof. V. Joshi', 'Prof. P. Kamath', 'Prof. Z. Khan', 'Prof. I. Sharma', 'Prof. O. Thakur', 'Prof. E. Gomes'],
}
export const allFaculty = Object.values(facultyPool).flat()
